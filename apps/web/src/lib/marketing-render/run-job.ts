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
import { parseMarketingRenderMode } from '@/lib/marketing-render/modes';
import { parseMarketingJobOptions } from '@/lib/marketing-render/job-options';
import {
  buildClickHighlightFilters,
  wantsAiGradePass,
  wantsMotionHighlights,
} from '@/lib/marketing-render/click-highlights-vf';
import { getResolvedFfmpegPath } from '@/lib/video/extract-frames';

const execFileAsync = promisify(execFile);

const PROBE = ['-probesize', '50M', '-analyzeduration', '50M'] as const;

const MODES_FROM_RAW_RECORDING: readonly MarketingRenderMode[] = [
  'branded_screen',
  'motion_walkthrough',
  'branded_plus_motion',
  'full_stack',
];

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

async function runFfmpegH264(params: {
  inputPath: string;
  outputPath: string;
  maxSeconds: number;
  vf: string;
}): Promise<void> {
  const ffmpeg = getResolvedFfmpegPath();
  const args = [
    '-hide_banner',
    '-y',
    ...PROBE,
    '-i',
    params.inputPath,
    '-t',
    String(params.maxSeconds),
    '-vf',
    params.vf,
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

/** Letterbox + optional click highlights + optional ffmpeg “grade” (placeholder until ai-service video pass). */
function buildMarketingVideoFilter(params: {
  padColor: string;
  mode: MarketingRenderMode;
  motionDrawboxes: string;
}): string {
  const pad = hexToFfmpegColor(params.padColor);
  let vf = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${pad}`;
  if (wantsMotionHighlights(params.mode) && params.motionDrawboxes) {
    vf = `${vf},${params.motionDrawboxes}`;
  }
  if (wantsAiGradePass(params.mode)) {
    vf = `${vf},eq=saturation=1.07:contrast=1.04:brightness=0.01`;
  }
  return vf;
}

/** Light polish on an existing H.264 export (neural style via ai-service is still future work). */
function buildPolishOnlyFilter(): string {
  return 'eq=saturation=1.08:contrast=1.05:brightness=0.012';
}

async function resolveBaseMarketingOutputUrl(params: {
  recordingId: string;
  userId: string;
  explicitJobId?: string | null;
}): Promise<string | null> {
  const id = params.explicitJobId?.trim();
  if (id) {
    const j = await prisma.marketingRenderJob.findFirst({
      where: {
        id,
        recordingId: params.recordingId,
        userId: params.userId,
        status: 'ready',
        outputUrl: { not: null },
      },
    });
    return j?.outputUrl?.trim() || null;
  }
  const j = await prisma.marketingRenderJob.findFirst({
    where: {
      recordingId: params.recordingId,
      userId: params.userId,
      status: 'ready',
      mode: { in: ['branded_screen', 'motion_walkthrough', 'branded_plus_motion'] },
      outputUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });
  return j?.outputUrl?.trim() || null;
}

/**
 * Process one queued job: download → ffmpeg → Supabase → DB ready/failed.
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

  const modeParsed = parseMarketingRenderMode(job.mode);
  if (!modeParsed) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: `Unknown marketing mode "${job.mode}"` },
    });
    return;
  }
  const mode = modeParsed;

  if (!job.recording) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: 'Recording missing for job' },
    });
    return;
  }

  if (mode !== 'ai_enhanced' && !job.recording.videoUrl?.trim()) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: 'Recording has no video URL' },
    });
    return;
  }

  if (mode !== 'ai_enhanced' && !(MODES_FROM_RAW_RECORDING as readonly string[]).includes(mode)) {
    await prisma.marketingRenderJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: `Mode "${mode}" is not supported by the worker.` },
    });
    return;
  }

  await prisma.marketingRenderJob.update({
    where: { id: jobId },
    data: { status: 'processing', error: null },
  });

  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'si-mr-'));
  const inputPath = path.join(tmpRoot, 'source.bin');
  const outputPath = path.join(tmpRoot, 'out.mp4');

  try {
    const parsedOpts = parseMarketingJobOptions(job.options);
    const maxSeconds = parsedOpts.maxSeconds;

    const primary =
      job.recording.project?.brandKit?.colorPrimary?.trim() || '#0f172a';

    const srcW = Math.max(1, job.recording.width || 1920);
    const srcH = Math.max(1, job.recording.height || 1080);
    const clickEvents = job.recording.clickEvents;

    let storageSuffix = 'branded.mp4';
    let vf: string;
    const motionDrawboxes = buildClickHighlightFilters(srcW, srcH, clickEvents);

    if (mode === 'ai_enhanced') {
      const baseUrl = await resolveBaseMarketingOutputUrl({
        recordingId: job.recordingId,
        userId: job.userId,
        explicitJobId: parsedOpts.baseMarketingJobId,
      });
      if (!baseUrl) {
        throw new Error(
          'No finished base marketing video found. Run Branded screen or Animated walkthrough first, or pass options.baseMarketingJobId for a specific ready job.'
        );
      }
      await downloadVideo(baseUrl, inputPath);
      vf = buildPolishOnlyFilter();
      storageSuffix = 'ai-polish.mp4';
    } else {
      await downloadVideo(job.recording.videoUrl!, inputPath);
      vf = buildMarketingVideoFilter({
        padColor: primary,
        mode,
        motionDrawboxes,
      });
    }

    await runFfmpegH264({ inputPath, outputPath, maxSeconds, vf });

    const buffer = await fs.promises.readFile(outputPath);
    const supabase = supabaseService();
    const storagePath = `${job.recording.projectId}/marketing/${jobId}/${storageSuffix}`;

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

    if (mode === 'ai_enhanced') {
      console.info(
        `[marketing-render] Job ${jobId}: polish pass on base export (neural AI style on video still TODO — see MARKETING_RENDERS.md).`
      );
    } else if (wantsMotionHighlights(mode) && !motionDrawboxes) {
      console.info(
        `[marketing-render] Job ${jobId}: no click/step markers on recording — output is letterboxed only.`
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
