import { rgb, type RGB } from 'pdf-lib';
/** Parse #RGB or #RRGGBB → 0–1 components for pdf-lib. */
export function parseHexToRgb01(hex: string | undefined | null): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16) / 255;
    const g = parseInt(h[1] + h[1], 16) / 255;
    const b = parseInt(h[2] + h[2], 16) / 255;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

export function hexToPdfRgb(hex: string | undefined | null, fallback: RGB): RGB {
  const p = parseHexToRgb01(hex);
  return p ? rgb(p.r, p.g, p.b) : fallback;
}

/** docx TextRun color: 6 hex chars, no # */
export function hexToDocxColor(hex: string | undefined | null, fallback: string): string {
  const p = parseHexToRgb01(hex);
  if (!p) return fallback;
  const to255 = (x: number) => Math.round(Math.min(255, Math.max(0, x * 255)));
  return `${to255(p.r).toString(16).padStart(2, '0')}${to255(p.g).toString(16).padStart(2, '0')}${to255(p.b).toString(16).padStart(2, '0')}`.toUpperCase();
}

/** Light header strip: blend primary toward white. */
export function headerBackgroundRgb(primaryHex: string | undefined | null): RGB {
  const p = parseHexToRgb01(primaryHex) ?? { r: 0.07, g: 0.36, b: 0.82 };
  const t = 0.1;
  return rgb((1 - t) + t * p.r, (1 - t) + t * p.g, (1 - t) + t * p.b);
}

