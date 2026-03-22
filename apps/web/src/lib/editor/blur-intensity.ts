/** Blur region strength 0 (subtle) – 100 (strong). */

export const BLUR_INTENSITY_DEFAULT = 50;

export function clampBlurIntensity(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return BLUR_INTENSITY_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Backdrop blur radius in px for CSS. */
export function blurRadiusPx(intensity: number): number {
  const t = clampBlurIntensity(intensity) / 100;
  return Math.round(t * 42); // 0–42px
}

/** Dark overlay alpha (frosted look) — scales with strength. */
export function blurOverlayAlpha(intensity: number): number {
  const t = clampBlurIntensity(intensity) / 100;
  return 0.04 + t * 0.52; // ~0.04–0.56
}
