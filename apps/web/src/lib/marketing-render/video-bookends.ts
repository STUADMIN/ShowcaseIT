import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { getResolvedFfmpegPath } from '@/lib/video/ffmpeg-resolve';

const execFileAsync = promisify(execFile);

/** Guide cover still duration before crossfading into the screen recording. */
const INTRO_CLIP_SEC = 2;
/** Hold outro still after the crossfade from the recording (seconds). */
const OUTRO_HOLD_SEC = 2.5;
/** Crossfade duration between intro↔main and main↔outro. */
const XFADE_SEC = 0.5;
/** Fade the intro still in from black at the start. */
const INTRO_FADE_IN_SEC = 0.45;

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download image (${res.status})`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeReadable = Readable.fromWeb(res.body as any);
  await pipeline(nodeReadable, createWriteStream(destPath));
}

async function probeVideoDurationSeconds(videoPath: string): Promise<number> {
  const ffmpeg = getResolvedFfmpegPath();
  const stderr = await new Promise<string>((resolve, reject) => {
    execFile(
      ffmpeg,
      ['-hide_banner', '-i', videoPath],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderrBuf) => {
        const s = String(stderrBuf || '');
        if (s.includes('Duration:')) resolve(s);
        else reject(err ?? new Error('Could not read video duration from ffmpeg'));
      }
    );
  });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) {
    throw new Error('Could not parse duration');
  }
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseFloat(m[3]);
  return h * 3600 + min * 60 + sec;
}

function scalePadChain(inputIndex: number, padRgb: string, extraVF: string | null, outLabel: string): string {
  const base = `[${inputIndex}:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${padRgb},format=yuv420p,setsar=1,setpts=PTS-STARTPTS`;
  const chain = extraVF ? `${base},${extraVF}` : base;
  return `${chain}[${outLabel}]`;
}

/**
 * Wraps a finished H.264 core export with optional intro (guide cover) and outro stills.
 * Intro fades in from black, crossfades into the recording, then the recording crossfades into the outro which stays on screen.
 */
export async function applyMarketingVideoBookends(params: {
  coreVideoPath: string;
  outputPath: string;
  introImageUrl: string | null | undefined;
  outroImageUrl: string | null | undefined;
  /** Letterbox pad color for ffmpeg, e.g. 0x2563eb */
  padColorFfmpeg: string;
}): Promise<void> {
  const intro = params.introImageUrl?.trim() || null;
  const outro = params.outroImageUrl?.trim() || null;
  if (!intro && !outro) {
    await fs.promises.copyFile(params.coreVideoPath, params.outputPath);
    return;
  }

  const tmpRoot = await fs.promises.mkdtemp(path.join(path.dirname(params.coreVideoPath), 'si-bookends-'));
  const filterScriptPath = path.join(tmpRoot, 'bookends.txt');
  try {
    const introPath = intro ? path.join(tmpRoot, 'intro.bin') : null;
    const outroPath = outro ? path.join(tmpRoot, 'outro.bin') : null;
    if (intro) await downloadToFile(intro, introPath!);
    if (outro) await downloadToFile(outro, outroPath!);

    const mainDur = await probeVideoDurationSeconds(params.coreVideoPath);
    if (!Number.isFinite(mainDur) || mainDur <= 0.1) {
      throw new Error('Core video duration invalid');
    }
    /** xfade needs overlap; skip bookends for extremely short cores to avoid invalid filter offsets. */
    if (mainDur < XFADE_SEC + 0.2) {
      await fs.promises.copyFile(params.coreVideoPath, params.outputPath);
      return;
    }

    const pad = params.padColorFfmpeg;
    const introOffset = INTRO_CLIP_SEC - XFADE_SEC;
    const outroClipSec = XFADE_SEC + OUTRO_HOLD_SEC;

    const args: string[] = ['-hide_banner', '-nostdin', '-y'];
    const lines: string[] = [];

    let idx = 0;
    if (intro) {
      args.push('-loop', '1', '-t', String(INTRO_CLIP_SEC), '-i', introPath!);
      lines.push(
        scalePadChain(idx, pad, `fade=t=in:st=0:d=${INTRO_FADE_IN_SEC}`, 'v0')
      );
      idx += 1;
    }

    args.push('-i', params.coreVideoPath);
    const mainIdx = idx;
    idx += 1;
    lines.push(scalePadChain(mainIdx, pad, null, 'v1'));

    if (outro) {
      args.push('-loop', '1', '-t', String(outroClipSec), '-i', outroPath!);
      lines.push(scalePadChain(idx, pad, null, 'v2'));
    }

    if (intro && outro) {
      const secondOffset = INTRO_CLIP_SEC + mainDur - 2 * XFADE_SEC;
      lines.push(`[v0][v1]xfade=transition=fade:duration=${XFADE_SEC}:offset=${introOffset.toFixed(3)}[vx]`);
      lines.push(
        `[vx][v2]xfade=transition=fade:duration=${XFADE_SEC}:offset=${secondOffset.toFixed(3)}[vfinal]`
      );
    } else if (intro) {
      lines.push(`[v0][v1]xfade=transition=fade:duration=${XFADE_SEC}:offset=${introOffset.toFixed(3)}[vfinal]`);
    } else if (outro) {
      const off = mainDur - XFADE_SEC;
      lines.push(`[v1][v2]xfade=transition=fade:duration=${XFADE_SEC}:offset=${off.toFixed(3)}[vfinal]`);
    }

    await fs.promises.writeFile(filterScriptPath, lines.join('\n'), 'utf8');

    args.push(
      '-filter_complex_script',
      filterScriptPath,
      '-map',
      '[vfinal]',
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
      params.outputPath
    );

    const ffmpeg = getResolvedFfmpegPath();
    const timeoutRaw = process.env.MARKETING_RENDER_FFMPEG_TIMEOUT_MS?.trim();
    const timeoutParsed = timeoutRaw ? parseInt(timeoutRaw, 10) : NaN;
    const timeoutMs =
      Number.isFinite(timeoutParsed) && timeoutParsed > 0 ? timeoutParsed : 45 * 60 * 1000;

    await execFileAsync(ffmpeg, args, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
    });
  } finally {
    await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  }
}
