/**
 * Build ffmpeg drawbox filters to flash highlights at step markers / clicks in letterboxed 1920×1080 output.
 * Click timestamps are **milliseconds** (recorder wall clock); ffmpeg `t` is seconds.
 */

const OUT_W = 1920;
const OUT_H = 1080;
const MAX_OVERLAYS = 56;
const BOX = 56;
const FLASH_SEC = 0.38;

export type StoredClickLike = {
  timestamp: number;
  x?: number;
  y?: number;
  button?: string;
};

function parseClicks(raw: unknown): StoredClickLike[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredClickLike[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const ts = typeof o.timestamp === 'number' ? o.timestamp : Number(o.timestamp);
    if (!Number.isFinite(ts)) continue;
    const x = typeof o.x === 'number' ? o.x : o.x !== undefined ? Number(o.x) : undefined;
    const y = typeof o.y === 'number' ? o.y : o.y !== undefined ? Number(o.y) : undefined;
    const button = typeof o.button === 'string' ? o.button : undefined;
    out.push({
      timestamp: ts,
      x: Number.isFinite(x) ? x : undefined,
      y: Number.isFinite(y) ? y : undefined,
      button,
    });
  }
  return out;
}

/**
 * Returns comma-separated drawbox filters (no leading comma). Empty string if no overlays.
 */
export function buildClickHighlightFilters(
  srcW: number,
  srcH: number,
  rawClicks: unknown,
  maxOverlays = MAX_OVERLAYS
): string {
  const w = Math.max(1, Math.floor(srcW));
  const h = Math.max(1, Math.floor(srcH));
  const clicks = parseClicks(rawClicks);
  if (clicks.length === 0) return '';

  const scale = Math.min(OUT_W / w, OUT_H / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const ox = Math.floor((OUT_W - nw) / 2);
  const oy = Math.floor((OUT_H - nh) / 2);

  const centerBox = (): { x: number; y: number } => ({
    x: ox + Math.max(0, Math.floor(nw / 2) - Math.floor(BOX / 2)),
    y: oy + Math.max(0, Math.floor(nh / 2) - Math.floor(BOX / 2)),
  });

  const sorted = [...clicks].sort((a, b) => a.timestamp - b.timestamp).slice(0, maxOverlays);

  const parts: string[] = [];
  for (const e of sorted) {
    const t0 = Math.max(0, e.timestamp / 1000);
    const t1 = t0 + FLASH_SEC;
    const isMarker = e.button === 'step-marker' || (e.x === 0 && e.y === 0);
    let x: number;
    let y: number;
    if (isMarker || typeof e.x !== 'number' || typeof e.y !== 'number') {
      const c = centerBox();
      x = c.x;
      y = c.y;
    } else {
      x = ox + Math.round(e.x * scale) - Math.floor(BOX / 2);
      y = oy + Math.round(e.y * scale) - Math.floor(BOX / 2);
    }
    x = Math.max(0, Math.min(OUT_W - BOX, x));
    y = Math.max(0, Math.min(OUT_H - BOX, y));
    // Commas inside enable= must be escaped in a filter chain (see ffmpeg filter docs).
    parts.push(
      `drawbox=x=${x}:y=${y}:w=${BOX}:h=${BOX}:color=white@0.38:t=fill:enable=between(t\\,${t0.toFixed(3)}\\,${t1.toFixed(3)})`
    );
  }
  return parts.join(',');
}

export function wantsMotionHighlights(mode: string): boolean {
  return (
    mode === 'motion_walkthrough' ||
    mode === 'branded_plus_motion' ||
    mode === 'full_stack'
  );
}

export function wantsAiGradePass(mode: string): boolean {
  return mode === 'ai_enhanced' || mode === 'full_stack';
}
