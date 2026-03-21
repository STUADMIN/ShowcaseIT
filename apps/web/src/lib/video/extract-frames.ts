import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const execFileAsync = promisify(execFile);

interface ExtractedFrame {
  timestamp: number;
  imageBuffer: Buffer;
}

const isWin = process.platform === 'win32';
const FFMPEG_EXE = isWin ? 'ffmpeg.exe' : 'ffmpeg';

/** Helps short / incomplete WebM from MediaRecorder mux correctly */
const PROBE_ARGS = ['-probesize', '50M', '-analyzeduration', '50M'] as const;

/**
 * Find ffmpeg-static binary without relying on require() (Next.js bundling / wrong cwd).
 * Walks upward from cwd and from this file's location until node_modules/ffmpeg-static is found.
 */
function collectWalkRoots(): string[] {
  const roots = new Set<string>();
  const add = (p: string) => {
    try {
      roots.add(path.resolve(p));
    } catch {
      /* ignore */
    }
  };

  add(process.cwd());
  add(path.join(process.cwd(), 'apps', 'web'));

  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    let dir = here;
    for (let i = 0; i < 24; i++) {
      add(dir);
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  } catch {
    /* ignore */
  }

  return [...roots];
}

function resolveFfmpegPath(): string | null {
  for (const root of collectWalkRoots()) {
    let dir = root;
    for (let depth = 0; depth < 22; depth++) {
      const candidate = path.join(dir, 'node_modules', 'ffmpeg-static', FFMPEG_EXE);
      if (fs.existsSync(candidate)) return candidate;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

let cachedFfmpeg: string | null | undefined;

function findFfmpeg(): string {
  if (cachedFfmpeg === undefined) {
    cachedFfmpeg = resolveFfmpegPath();
  }
  if (cachedFfmpeg) return cachedFfmpeg;

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const linksPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
    if (fs.existsSync(linksPath)) return linksPath;
  }
  return 'ffmpeg';
}

function parseDurationFromFfmpegStderr(stderr: string): number | null {
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseFloat(m[3]);
  const ms = ((h * 60 + min) * 60 + sec) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Duration in ms from ffmpeg stderr (no ffprobe — ffprobe-static npm package often has no binaries). */
async function getVideoDurationMs(videoPath: string): Promise<number | null> {
  const ffmpeg = findFfmpeg();
  try {
    await execFileAsync(ffmpeg, ['-hide_banner', ...PROBE_ARGS, '-i', videoPath], {
      maxBuffer: 12 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr: Buffer }).stderr)
        : err instanceof Error
          ? err.message
          : '';
    const ms = parseDurationFromFfmpegStderr(stderr);
    if (ms != null) return ms;
  }
  return null;
}

/**
 * Extract one frame. Uses -ss after -i for WebM/VP8/VP9 from browser MediaRecorder.
 * At t≈0, also tries without -ss (first keyframe) — seeking to 0 often fails on WebM.
 */
async function extractFrameAt(videoPath: string, timestampMs: number, outputPath: string): Promise<void> {
  const ffmpeg = findFfmpeg();
  const seconds = Math.max(0, timestampMs / 1000);

  const attempts: string[][] = [];

  if (seconds < 0.05) {
    attempts.push([
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      ...PROBE_ARGS,
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      outputPath,
    ]);
  }

  attempts.push([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    ...PROBE_ARGS,
    '-i',
    videoPath,
    '-ss',
    seconds.toFixed(3),
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outputPath,
  ]);

  attempts.push([
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    seconds.toFixed(3),
    ...PROBE_ARGS,
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    '-y',
    outputPath,
  ]);

  let lastErr: unknown;
  for (const args of attempts) {
    try {
      await execFileAsync(ffmpeg, args, { maxBuffer: 40 * 1024 * 1024 });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Sample frames along the **decoded** timeline (not by seek).
 * Browser WebM often returns the same keyframe for many `-ss` positions; this captures real UI progression.
 */
async function extractFramesAlongTimeline(
  videoPath: string,
  tmpDir: string,
  durationMs: number,
  maxFramesOut: number
): Promise<ExtractedFrame[]> {
  const ffmpeg = findFfmpeg();
  const durationSec = Math.max(0.2, durationMs / 1000);
  // ~1 frame every 0.28s — more samples so fast scrolls / short modals aren’t skipped
  const fromDuration = Math.ceil(durationSec / 0.28);
  const frameCount = Math.min(120, Math.max(22, Math.min(fromDuration, maxFramesOut)));
  const fps = frameCount / durationSec;

  const normalizedVideo = videoPath.replace(/\\/g, '/');
  const outPattern = path.join(tmpDir, 'tl-%04d.png').replace(/\\/g, '/');

  try {
    await execFileAsync(
      ffmpeg,
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        ...PROBE_ARGS,
        '-i',
        normalizedVideo,
        '-vf',
        `fps=${fps.toFixed(5)}`,
        '-frames:v',
        String(frameCount),
        '-q:v',
        '2',
        outPattern,
      ],
      { maxBuffer: 80 * 1024 * 1024 }
    );
  } catch (e) {
    console.warn('[extractFramesAlongTimeline] fps extract failed:', e);
    return [];
  }

  const files = (await fs.promises.readdir(tmpDir))
    .filter((f) => /^tl-\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0], 10);
      const nb = parseInt(b.match(/\d+/)![0], 10);
      return na - nb;
    });

  const frames: ExtractedFrame[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const p = path.join(tmpDir, file);
    const imageBuffer = await fs.promises.readFile(p);
    if (imageBuffer.length <= 200) continue;
    // Spread timestamps across measured duration so guide ordering matches the clip
    const t =
      files.length <= 1
        ? 0
        : Math.min(durationMs - 1, Math.round((i / (files.length - 1)) * Math.max(1, durationMs - 1)));
    frames.push({ timestamp: t, imageBuffer });
  }
  return frames;
}

async function extractFramesByProbing(
  videoPath: string,
  tmpDir: string,
  maxFrames: number
): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  const offsets = [0, 50, 100, 250, 500, 1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 45000, 60000];
  for (let i = 0; i < offsets.length && frames.length < maxFrames; i++) {
    const t = offsets[i];
    const framePath = path.join(tmpDir, `probe-${i}.png`);
    try {
      await extractFrameAt(videoPath, t, framePath);
      const imageBuffer = await fs.promises.readFile(framePath);
      if (imageBuffer.length > 200) {
        frames.push({ timestamp: t, imageBuffer });
      }
    } catch {
      // Never bail on first failure — t=0 often fails on WebM when only keyframe seek works at later times
      continue;
    }
  }
  return frames;
}

function looksLikeWebmOrMatroska(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // EBML / WebM / Matroska
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  return false;
}

/** Greyscale sample at pixel (clamped). */
function greyAt(png: PNG, px: number, py: number): number {
  const x = Math.max(0, Math.min(png.width - 1, px));
  const y = Math.max(0, Math.min(png.height - 1, py));
  const i = (png.width * y + x) << 2;
  const r = png.data[i];
  const g = png.data[i + 1];
  const b = png.data[i + 2];
  return (r + g + b) / 3;
}

/**
 * 8×8 average hash for near-duplicate screenshot detection (cursor-only changes often stay below threshold).
 */
function averageHashFromPngBuffer(imageBuffer: Buffer): bigint | null {
  try {
    const png = PNG.sync.read(imageBuffer);
    if (png.width < 8 || png.height < 8) return null;
    const samples: number[] = [];
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        const px = Math.floor(((i + 0.5) / 8) * png.width);
        const py = Math.floor(((j + 0.5) / 8) * png.height);
        samples.push(greyAt(png, px, py));
      }
    }
    const mean = samples.reduce((a, b) => a + b, 0) / 64;
    let h = 0n;
    for (let k = 0; k < 64; k++) {
      if (samples[k] >= mean) h |= 1n << BigInt(k);
    }
    return h;
  } catch {
    return null;
  }
}

function hamming64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x !== 0n) {
    n++;
    x &= x - 1n;
  }
  return n;
}

/** Finer grid catches smaller scrolls / panel shifts than 16×12. */
const GRID_W = 24;
const GRID_H = 16;

/** Normalized luminance samples (0–1) on a coarse grid — sensitive to scroll/modal changes vs tiny 8×8 hash. */
function luminanceGridFromPngBuffer(imageBuffer: Buffer): number[] | null {
  try {
    const png = PNG.sync.read(imageBuffer);
    if (png.width < GRID_W || png.height < GRID_H) return null;
    const out: number[] = [];
    for (let j = 0; j < GRID_H; j++) {
      for (let i = 0; i < GRID_W; i++) {
        const px = Math.floor(((i + 0.5) / GRID_W) * png.width);
        const py = Math.floor(((j + 0.5) / GRID_H) * png.height);
        const lum = greyAt(png, px, py) / 255;
        out.push(lum);
      }
    }
    return out;
  } catch {
    return null;
  }
}

function meanAbsDiffGrids(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  return s / a.length;
}

/**
 * For **auto** timeline capture (no Mark step): 8×8 aHash alone merges scrolls/modals into one step.
 * Skip a frame only when **both** aHash is close **and** the luminance grid barely moved (cursor / idle).
 */
export function dedupeAutoTimelineFrames(frames: ExtractedFrame[]): ExtractedFrame[] {
  const sorted = [...frames].sort((a, b) => a.timestamp - b.timestamp);
  const out: ExtractedFrame[] = [];
  let lastGrid: number[] | null = null;
  let lastHash: bigint | null = null;

  for (const frame of sorted) {
    const grid = luminanceGridFromPngBuffer(frame.imageBuffer);
    const hash = averageHashFromPngBuffer(frame.imageBuffer);

    if (grid === null || hash === null) {
      out.push(frame);
      lastGrid = grid;
      lastHash = hash;
      continue;
    }
    if (lastGrid === null || lastHash === null) {
      out.push(frame);
      lastGrid = grid;
      lastHash = hash;
      continue;
    }

    const mad = meanAbsDiffGrids(grid, lastGrid);
    const hm = hamming64(hash, lastHash);

    // Strong macro change → always a new step
    if (hm > 12) {
      out.push(frame);
      lastGrid = grid;
      lastHash = hash;
      continue;
    }

    // Scrolls / modals — keep once average cell luminance shifts enough (tuned for subtle scroll)
    if (mad >= 0.0048) {
      out.push(frame);
      lastGrid = grid;
      lastHash = hash;
      continue;
    }

    // Merge only when layout and pixels are both nearly unchanged (cursor / loading shimmer)
    if (hm <= 9 && mad < 0.0038) {
      continue;
    }

    out.push(frame);
    lastGrid = grid;
    lastHash = hash;
  }
  return out;
}

/**
 * Drop frames that look the same as the previous kept frame (common when time-sampling a static login screen).
 * Sorted by timestamp ascending.
 */
export function dedupeVisuallySimilarFrames(
  frames: ExtractedFrame[],
  maxHamming = 10
): ExtractedFrame[] {
  const sorted = [...frames].sort((a, b) => a.timestamp - b.timestamp);
  const out: ExtractedFrame[] = [];
  let lastHash: bigint | null = null;

  for (const frame of sorted) {
    const h = averageHashFromPngBuffer(frame.imageBuffer);
    if (h === null) {
      out.push(frame);
      lastHash = null;
      continue;
    }
    if (lastHash !== null && hamming64(h, lastHash) <= maxHamming) {
      continue;
    }
    out.push(frame);
    lastHash = h;
  }
  return out;
}

/** Merge timestamps that are at least `minGapMs` apart (sorted). */
function mergeTimesByMinGap(times: number[], minGapMs: number): number[] {
  const sorted = [...new Set(times)].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    if (out.length === 0 || t - out[out.length - 1] >= minGapMs) {
      out.push(t);
    }
  }
  return out;
}

/**
 * When there are no click/marker times, spread samples across the timeline and bias toward the end
 * so late UI (e.g. post-login) is not missed after a long static segment.
 */
/** Concatenate timeline + seek extractions and order by time (visual dedupe runs later). */
function mergeFrameListsPreferUnique(a: ExtractedFrame[], b: ExtractedFrame[]): ExtractedFrame[] {
  return [...a, ...b].sort((x, y) => x.timestamp - y.timestamp);
}

/**
 * When we have more frames than `max`, spread picks across the **whole** recording.
 * `slice(0, max)` would keep only the beginning and silently drop the last minutes.
 */
function pickEvenlySpaced<T>(items: T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const n = items.length;
  const idx = new Set<number>();
  for (let k = 0; k < max; k++) {
    const i = Math.round((k * (n - 1)) / Math.max(1, max - 1));
    idx.add(Math.min(n - 1, Math.max(0, i)));
  }
  for (let i = n - 1; idx.size < max && i >= 0; i--) idx.add(i);
  for (let i = 0; idx.size < max && i < n; i++) idx.add(i);
  return [...idx].sort((a, b) => a - b).map((j) => items[j]!);
}

function limitExtractedFrames(frames: ExtractedFrame[], max: number): ExtractedFrame[] {
  const sorted = [...frames].sort((a, b) => a.timestamp - b.timestamp);
  return pickEvenlySpaced(sorted, max);
}

async function extractSeekFramesAtTimestamps(
  videoPath: string,
  tmpDir: string,
  timestamps: number[],
  filePrefix: string
): Promise<ExtractedFrame[]> {
  const seekFrames: ExtractedFrame[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const framePath = path.join(tmpDir, `${filePrefix}-${i}.png`);
    try {
      await extractFrameAt(videoPath, timestamps[i]!, framePath);
      const imageBuffer = await fs.promises.readFile(framePath);
      if (imageBuffer.length > 200) {
        seekFrames.push({ timestamp: timestamps[i]!, imageBuffer });
      }
    } catch {
      /* skip */
    }
  }
  return seekFrames;
}

function buildIntervalCandidateTimestamps(durationMs: number, candidateCount: number): number[] {
  const safeEnd = Math.max(0, durationMs - 250);
  const anchors = [0.08, 0.22, 0.4, 0.58, 0.72, 0.84, 0.9, 0.94, 0.97, 0.99].map((p) =>
    Math.round(durationMs * p)
  );
  const intervalMs = Math.max(2000, durationMs / (candidateCount + 2));
  const uniform: number[] = [];
  for (let t = intervalMs; t < safeEnd; t += intervalMs) {
    uniform.push(Math.round(t));
    if (uniform.length >= candidateCount) break;
  }
  const merged = mergeTimesByMinGap([...uniform, ...anchors, Math.max(0, safeEnd - 400)], 650);
  return merged.filter((t) => t >= 0 && t <= durationMs + 500).slice(0, candidateCount);
}

/**
 * Extract frames from a video at given click / “Mark step” timestamps.
 * When `clickTimestamps.length > 0`, only those times are used (up to `maxFrames`) — no extra interval sampling.
 * If none provided, decodes along the timeline with an `fps` filter (avoids WebM seek/keyframe repeats),
 * optionally supplemented by seek samples if the timeline pass is thin.
 */
export async function extractFrames(
  videoBuffer: Buffer,
  clickTimestamps: number[] = [],
  maxFrames = 20
): Promise<ExtractedFrame[]> {
  const ffmpegPath = findFfmpeg();
  if (isWin && !fs.existsSync(ffmpegPath)) {
    console.error(
      '[extractFrames] ffmpeg.exe not found. cwd=%s tried walking from cwd and from extract-frames.ts',
      process.cwd()
    );
    return [];
  }
  if (!isWin && ffmpegPath === 'ffmpeg') {
    // rely on PATH on macOS/Linux
  }

  if (videoBuffer.length < 200) {
    return [];
  }
  if (!looksLikeWebmOrMatroska(videoBuffer)) {
    console.warn('[extractFrames] buffer does not start with WebM/Matroska EBML header — may not be a valid video');
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'showcaseit-'));

  try {
    const videoPath = path.join(tmpDir, 'input.webm');
    await fs.promises.writeFile(videoPath, videoBuffer);

    const durationMs = await getVideoDurationMs(videoPath);

    const useClicks = clickTimestamps.length > 0;
    let frames: ExtractedFrame[] = [];

    if (durationMs != null && durationMs > 0 && !useClicks) {
      // No markers: decode along timeline (reliable for WebM); seek-based often repeats one keyframe.
      const internalCap = Math.min(120, Math.max(maxFrames * 2, 44));
      frames = await extractFramesAlongTimeline(videoPath, tmpDir, durationMs, internalCap);
    }

    if (useClicks && durationMs != null && durationMs > 0) {
      let timestamps = [...new Set(clickTimestamps)]
        .filter((t) => t >= 0 && t <= durationMs + 2000)
        .sort((a, b) => a - b);

      const deduped: number[] = [];
      for (const t of timestamps) {
        if (deduped.length === 0 || t - deduped[deduped.length - 1] > 500) {
          deduped.push(t);
        }
      }
      timestamps = pickEvenlySpaced(deduped, maxFrames);
      if (timestamps.length === 0) {
        timestamps = [Math.min(500, Math.max(100, durationMs / 3))];
      }
      frames = await extractSeekFramesAtTimestamps(videoPath, tmpDir, timestamps, 'click');
    } else if (durationMs != null && durationMs > 0 && !useClicks) {
      if (frames.length < 4) {
        const candidateCount = Math.min(36, Math.max(maxFrames * 2, 24));
        let timestamps = buildIntervalCandidateTimestamps(durationMs, candidateCount);
        if (timestamps.length === 0) {
          timestamps = [Math.min(500, Math.max(100, durationMs / 3))];
        }
        const seekFrames = await extractSeekFramesAtTimestamps(videoPath, tmpDir, timestamps, 'fill');
        frames =
          frames.length > 0 ? mergeFrameListsPreferUnique(frames, seekFrames) : seekFrames;
      }
    }

    // MUST await: without await, `finally` deletes tmpDir while probing still runs → zero frames
    if (frames.length === 0) {
      const probed = await extractFramesByProbing(videoPath, tmpDir, maxFrames);
      const d = useClicks
        ? dedupeVisuallySimilarFrames(probed, 11)
        : dedupeAutoTimelineFrames(probed);
      return limitExtractedFrames(d, maxFrames);
    }

    const distinct = useClicks
      ? dedupeVisuallySimilarFrames(frames, 11)
      : dedupeAutoTimelineFrames(frames);
    return limitExtractedFrames(distinct, maxFrames);
  } catch (e) {
    console.error('[extractFrames] failed:', e);
    return [];
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

/** For diagnostics / health checks */
export function getResolvedFfmpegPath(): string {
  return findFfmpeg();
}
