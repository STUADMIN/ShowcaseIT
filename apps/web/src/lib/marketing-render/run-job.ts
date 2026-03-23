import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db/prisma';
import type { MarketingRenderMode } from '@/lib/marketing-render/modes';
import { MARKETING_RENDER_IMPLEMENTED_MODES } from '@/lib/marketing-render/modes';
import { parseMarketingJobOptions } from '@/lib/marketing-render/job-options';
import type { MarketingBannerPosition } from '@/lib/marketing-render/job-options';
import { getResolvedFfmpegPath } from '@/lib/video/extract-frames';

const execFileAsync = promisify(execFile);

const PROBE = ['-probesize', '50M', '-analyzeduration', '50M'] as const;

function hexToFfmpegColor(hex: string): string {
  const s = hex.replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `0x${s}`;
  return '0x0f172a';
}

async function downloadVideo(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(900_000) });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download source video (${res.status})`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Readable.fromWeb Body
  const nodeReadable = Readable.fromWeb(res.body as any);
  await pipeline(nodeReadable, createWriteStream(destPath));
}

function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for uploads');
  }
  return createClient(url, key);
}

/**
 * Branded letterbox (Brand Kit primary as pad) + H.264 MP4 for wide compatibility.
 * Audio stripped for reliability (marketing clip can be silent or re-add music later).
 */
async function runBrandedFfmpeg(params: {
  inputPath: string;
  outputPath: string;
  padColor: string;
  maxSeconds: number;
}): Promise<void> {
  const ffmpeg = getResolvedFfmpegPath();
  const pad = hexToFfmpegColor(params.padColor);
  const vf = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${pad}`;

  const args = [
    '-hide_banner',
    '-y',
    ...PROBE,
    '-i',
    params.inputPath,
    '-t',
    String(params.maxSeconds),
    '-vf',
    vf,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    params.outputPath,
  ];

  await execFileAsync(ffmpeg, args, { maxBuffer: 20 * 1024 * 1024 });
}

const FFMPEG_MODES: readonly MarketingRenderMode[] = MARKETING_RENDER_IMPLEMENTED_MODES;

/**
 * Process one queued job: download → ffmpeg (branded modes) → Supabase → DB ready/failed.
 */
export async function executeMarketingRenderJob(jobId: string): Promise<void> {
  if (process.env.VERCEL === '1' && process.env.MARKETING_RENDER_VERCEL !== '1') {
    await prisma.marketingRenderJob.updateMany({
      where: { id: jobId, status: 'queued' },
      data: {
        status: 'failed',
        error:
          'Marketing renders are not executed on Vercel serverless by default (timeouts / no ffmpeg). Run `npm run worker:marketing` from apps/web on a VM or laptop, or set MARKETING_RENDER_VERCEL=1 only for short experiments. See apps/web/docs/MARKETING_RENDERS.md.',
      },
    });
    return;
  }

  const job = await prisma.marketingRenderJob.findUnique({
    where: { id: jobId },
    include: {
      recording: {
        include: {
          project: { include: { brandKit: true } },
        },
      },
    },
  });

  if (!job) return;
  if (job.status !== 'queued') return;
  if (!job.recording?.videoUrl?.trim()) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: 'Recording has no video URL' },
    });
    return;
  }

  const mode = job.mode;
  if (!(FFMPEG_MODES as readonly string[]).includes(mode)) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error:
          mode === 'motion_walkthrough'
            ? 'Motion walkthrough renderer is not implemented yet. Use branded_screen for now.'
            : mode === 'ai_enhanced'
              ? 'AI-enhanced mode needs a base render first — not implemented yet.'
              : `Mode "${mode}" is not supported by the worker yet.`,
      },
    });
    return;
  }

  await prisma.marketingRenderJob.update({
    where: { id: jobId },
    data: { status: 'processing', error: null },
  });

  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'si-mr-'));
  const inputPath = path.join(tmpRoot, 'source.webm');
  const outputPath = path.join(tmpRoot, 'out.mp4');

  try {
    const opts = job.options as { maxSeconds?: unknown } | null;
    const maxSeconds = clampMaxSeconds(opts?.maxSeconds);

    await downloadVideo(job.recording.videoUrl, inputPath);

    const primary =
      job.recording.project?.brandKit?.colorPrimary?.trim() || '#0f172a';

    await runBrandedFfmpeg({
      inputPath,
      outputPath,
      padColor: primary,
      maxSeconds,
    });

    const buffer = await fs.promises.readFile(outputPath);
    const supabase = supabaseService();
    const storagePath = `${job.recording.projectId}/marketing/${jobId}/branded.mp4`;

    const { error: upErr } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (upErr) {
      throw new Error(`Storage upload failed: ${upErr.message}`);
    }

    const { data: pub } = supabase.storage.from('recordings').getPublicUrl(storagePath);

    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: {
        status: 'ready',
        outputUrl: pub.publicUrl,
        error: null,
      },
    });

    if (mode === 'full_stack' || mode === 'branded_plus_motion') {
      console.info(
        `[marketing-render] Job ${jobId}: branded MP4 only; motion + AI steps not run yet (see MARKETING_RENDERS.md).`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: msg.slice(0, 2000),
      },
    });
  } finally {
    await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  }
}
