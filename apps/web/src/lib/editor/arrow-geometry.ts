/**
 * Arrow in normalized coordinates (same 0–100 space as guide annotations).
 * Shaft stops at the head base so the triangle meets the line cleanly.
 */
export function computeArrowParts(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): {
  shaftEnd: { x: number; y: number };
  tip: { x: number; y: number };
  wing1: { x: number; y: number };
  wing2: { x: number; y: number };
} {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 0.001;
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  /** Head length along the line — scales with arrow length, clamped for short drags */
  const headLen = Math.min(5.2, Math.max(2.6, L * 0.13));
  /** Wing half-width — ratio tuned for a balanced “UI annotation” look */
  const headW = headLen * 0.62;
  const ex = x2 - ux * headLen;
  const ey = y2 - uy * headLen;
  return {
    shaftEnd: { x: ex, y: ey },
    tip: { x: x2, y: y2 },
    wing1: { x: ex + px * (headW / 2), y: ey + py * (headW / 2) },
    wing2: { x: ex - px * (headW / 2), y: ey - py * (headW / 2) },
  };
}
