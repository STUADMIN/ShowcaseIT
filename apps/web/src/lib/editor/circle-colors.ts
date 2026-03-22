/** Bright / neon fills for highlight rectangles (editor + HTML export). */
export const HIGHLIGHT_COLOR_PRESETS = [
  { key: 'neon-lime', label: 'Neon lime', stroke: '#b8ff00' },
  { key: 'neon-cyan', label: 'Neon cyan', stroke: '#00f5ff' },
  { key: 'hot-pink', label: 'Hot pink', stroke: '#ff2d95' },
  { key: 'electric-yellow', label: 'Electric yellow', stroke: '#fff01f' },
  { key: 'orange-burst', label: 'Orange burst', stroke: '#ff6b35' },
  { key: 'electric-purple', label: 'Electric purple', stroke: '#c84bff' },
  { key: 'neon-green', label: 'Neon green', stroke: '#39ff14' },
  { key: 'magenta-flash', label: 'Magenta flash', stroke: '#ff00ea' },
] as const;

/** Preset outline colours for circle annotations (editor + HTML export). */
export const CIRCLE_OUTLINE_PRESETS = [
  { key: 'sky', label: 'Sky blue', stroke: '#38bdf8' },
  { key: 'amber', label: 'Amber', stroke: '#fbbf24' },
  { key: 'emerald', label: 'Emerald', stroke: '#34d399' },
  { key: 'fuchsia', label: 'Fuchsia', stroke: '#e879f9' },
  { key: 'red', label: 'Red', stroke: '#ef4444' },
  { key: 'rose', label: 'Rose', stroke: '#fb7185' },
  { key: 'slate', label: 'Slate', stroke: '#94a3b8' },
  { key: 'white', label: 'White', stroke: '#f1f5f9' },
] as const;

export type CircleOutlinePresetKey = (typeof CIRCLE_OUTLINE_PRESETS)[number]['key'];

const DEFAULT_STROKE = CIRCLE_OUTLINE_PRESETS[0].stroke;

/** Highlights created before colour picker stored no `color` — keep amber look. */
const HIGHLIGHT_DEFAULT_STROKE = '#fbbf24';

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return { r: 56, g: 189, b: 248 };
}

/** Semi-transparent fill inside the ellipse. */
export function circleFillRgba(strokeHex: string, alpha = 0.14): string {
  const { r, g, b } = hexToRgb(strokeHex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolve stored highlight colour (hex) or legacy amber default. */
export function resolveHighlightColor(stored: string | undefined): string {
  if (!stored || typeof stored !== 'string') return HIGHLIGHT_DEFAULT_STROKE;
  const h = stored.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h;
  const hi = HIGHLIGHT_COLOR_PRESETS.find((p) => p.stroke.toLowerCase() === h.toLowerCase());
  return hi?.stroke ?? HIGHLIGHT_DEFAULT_STROKE;
}

/** Resolve stored annotation colour (hex) or default sky. */
export function resolveCircleStroke(stored: string | undefined): string {
  if (!stored || typeof stored !== 'string') return DEFAULT_STROKE;
  const h = stored.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h;
  const preset = CIRCLE_OUTLINE_PRESETS.find((p) => p.stroke.toLowerCase() === h.toLowerCase());
  return preset?.stroke ?? DEFAULT_STROKE;
}
