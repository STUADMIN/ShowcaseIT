/**
 * Brand kit color fields may be a solid hex (#RGB / #RRGGBB) or a CSS
 * linear-gradient / radial-gradient for HTML export. PDF/DOCX use the first hex found.
 */

/** Two explicit percentage stops, e.g. `linear-gradient(319deg, #02143F 23.29%, #49898A 76.71%)` */
const SIMPLE_LINEAR_WITH_STOPS_RE =
  /^linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*(#[0-9A-Fa-f]{3,8})\s+(\d+(?:\.\d+)?)%\s*,\s*(#[0-9A-Fa-f]{3,8})\s+(\d+(?:\.\d+)?)%\s*\)$/i;

/** Legacy: implicit 0% / 100% stops (optional explicit 0% / 100%) */
const SIMPLE_LINEAR_LEGACY_RE =
  /^linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*(#[0-9A-Fa-f]{3,8})(?:\s+0%)?\s*,\s*(#[0-9A-Fa-f]{3,8})(?:\s+100%)?\s*\)$/i;

function formatGradientAngle(deg: number): string {
  const v = Math.min(360, Math.max(0, Number(deg)));
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

function formatGradientPercent(n: number): string {
  const v = Math.min(100, Math.max(0, Number(n)));
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

/** One-click examples for the brand ColorPicker (HTML export; PDF/DOCX flatten to first hex). */
export const BRAND_GRADIENT_PRESETS: ReadonlyArray<{ id: string; label: string; value: string }> = [
  {
    id: 'ocean-deep',
    label: 'Ocean deep',
    value: 'linear-gradient(319deg, #02143F 23.29%, #49898A 76.71%)',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    value: 'linear-gradient(225deg, #1E1B4B 12%, #BE185D 88%)',
  },
  {
    id: 'forest',
    label: 'Forest',
    value: 'linear-gradient(160deg, #022C22 20%, #059669 80%)',
  },
];

export function isCssGradient(value: string): boolean {
  const t = value.trim().toLowerCase();
  return t.startsWith('linear-gradient(') || t.startsWith('radial-gradient(');
}

/** Block obvious injection in pasted gradient CSS. */
export function sanitizeGradientCss(input: string): string | null {
  const s = input.trim();
  if (s.length < 15 || s.length > 480) return null;
  const lower = s.toLowerCase();
  if (
    lower.includes('url(') ||
    lower.includes('javascript:') ||
    lower.includes('expression(') ||
    lower.includes('@import')
  ) {
    return null;
  }
  if (!lower.startsWith('linear-gradient(') && !lower.startsWith('radial-gradient(')) return null;
  if (!s.endsWith(')')) return null;
  return s;
}

export function expandShortHex(hex: string): string {
  const h = hex.replace(/^#/, '');
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  }
  if (h.length === 6) return `#${h}`.toUpperCase();
  return hex.startsWith('#') ? hex : `#${hex}`;
}

/** First #hex in a string (e.g. first gradient stop), or solid hex if the whole value is hex. */
export function solidBrandHex(raw: string | undefined | null, fallback: string): string {
  const fbStr = fallback.startsWith('#') ? fallback : `#${fallback}`;
  const fb =
    /^#[0-9A-Fa-f]{3}$/i.test(fbStr) || /^#[0-9A-Fa-f]{6}$/i.test(fbStr)
      ? expandShortHex(fbStr)
      : '#2563EB';
  if (!raw?.trim()) return fb;
  const t = raw.trim();
  if (/^#[0-9A-Fa-f]{3}$/i.test(t) || /^#[0-9A-Fa-f]{6}$/i.test(t)) return expandShortHex(t);
  const re = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/gi;
  const m = re.exec(t);
  if (m) return expandShortHex(m[0]);
  return fb;
}

/** Safe `background` value for CSS (gradient or hex). */
export function brandPaintCss(raw: string | undefined | null, fallbackSolid: string): string {
  if (!raw?.trim()) return expandShortHex(fallbackSolid);
  const t = raw.trim();
  if (isCssGradient(t)) {
    const s = sanitizeGradientCss(t);
    return s ?? expandShortHex(fallbackSolid);
  }
  if (/^#[0-9A-Fa-f]{3}$/i.test(t) || /^#[0-9A-Fa-f]{6}$/i.test(t)) return expandShortHex(t);
  return expandShortHex(fallbackSolid);
}

export type ParsedSimpleLinearGradient = {
  angle: number;
  color1: string;
  color2: string;
  stop1: number;
  stop2: number;
};

export function parseSimpleLinearGradient(value: string): ParsedSimpleLinearGradient | null {
  if (!isCssGradient(value)) return null;
  const t = value.trim();
  const withStops = t.match(SIMPLE_LINEAR_WITH_STOPS_RE);
  if (withStops) {
    return {
      angle: Number(withStops[1]) || 0,
      color1: expandShortHex(withStops[2]),
      color2: expandShortHex(withStops[4]),
      stop1: Number(withStops[3]) || 0,
      stop2: Number(withStops[5]) || 100,
    };
  }
  const legacy = t.match(SIMPLE_LINEAR_LEGACY_RE);
  if (legacy) {
    return {
      angle: Number(legacy[1]) || 0,
      color1: expandShortHex(legacy[2]),
      color2: expandShortHex(legacy[3]),
      stop1: 0,
      stop2: 100,
    };
  }
  return null;
}

/** Build a 2-stop linear gradient. Stops default to 0% and 100%. */
export function buildSimpleLinearGradient(
  angle: number,
  color1: string,
  color2: string,
  stop1: number = 0,
  stop2: number = 100
): string {
  const c1 = expandShortHex(color1);
  const c2 = expandShortHex(color2);
  const angStr = formatGradientAngle(angle);
  const s1 = formatGradientPercent(stop1);
  const s2 = formatGradientPercent(stop2);
  return `linear-gradient(${angStr}deg, ${c1} ${s1}%, ${c2} ${s2}%)`;
}
