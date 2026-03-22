/**
 * Brand kit color fields may be a solid hex (#RGB / #RRGGBB) or a CSS
 * linear-gradient / radial-gradient for HTML export. PDF/DOCX use the first hex found.
 */

const SIMPLE_LINEAR_RE =
  /^linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*(#[0-9A-Fa-f]{3,8})\s+(?:0%)?\s*,\s*(#[0-9A-Fa-f]{3,8})\s+(?:100%)?\s*\)$/i;

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

export function parseSimpleLinearGradient(
  value: string
): { angle: number; color1: string; color2: string } | null {
  if (!isCssGradient(value)) return null;
  const m = value.trim().match(SIMPLE_LINEAR_RE);
  if (!m) return null;
  return {
    angle: Math.round(Number(m[1]) || 135),
    color1: expandShortHex(m[2]),
    color2: expandShortHex(m[3]),
  };
}

export function buildSimpleLinearGradient(angle: number, color1: string, color2: string): string {
  const a = Math.min(360, Math.max(0, Math.round(angle)));
  const c1 = expandShortHex(color1);
  const c2 = expandShortHex(color2);
  return `linear-gradient(${a}deg, ${c1} 0%, ${c2} 100%)`;
}
