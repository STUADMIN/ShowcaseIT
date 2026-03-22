/** Percent coords (0–100) for moving overlays on the step screenshot. */

export function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function clampRectPos(pos: number, size: number): number {
  const s = Math.min(size, 100);
  return Math.max(0, Math.min(100 - s, pos));
}

export interface LooseAnnotation {
  id: string;
  type: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  calloutTailEdge?: string;
  calloutTailOffset?: number;
}

export interface LooseBlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
}

export function blurRegionWithDelta(r: LooseBlurRegion, dx: number, dy: number): LooseBlurRegion {
  return {
    ...r,
    x: clampRectPos(r.x + dx, r.width),
    y: clampRectPos(r.y + dy, r.height),
  };
}

export function annotationWithDelta(ann: LooseAnnotation, dx: number, dy: number): LooseAnnotation {
  if (ann.type === 'arrow' && ann.x2 != null && ann.y2 != null) {
    return {
      ...ann,
      x: clampPct(ann.x + dx),
      y: clampPct(ann.y + dy),
      x2: clampPct(ann.x2 + dx),
      y2: clampPct(ann.y2 + dy),
    };
  }
  if (ann.type === 'badge' || ann.type === 'text') {
    return { ...ann, x: clampPct(ann.x + dx), y: clampPct(ann.y + dy) };
  }
  if (
    (ann.type === 'highlight' ||
      ann.type === 'circle' ||
      ann.type === 'box' ||
      ann.type === 'callout') &&
    ann.width != null &&
    ann.height != null
  ) {
    return {
      ...ann,
      x: clampRectPos(ann.x + dx, ann.width),
      y: clampRectPos(ann.y + dy, ann.height),
    };
  }
  if (ann.type === 'callout') {
    return { ...ann, x: clampPct(ann.x + dx), y: clampPct(ann.y + dy) };
  }
  return { ...ann, x: clampPct(ann.x + dx), y: clampPct(ann.y + dy) };
}
