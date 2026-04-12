/** Multi-directional callout pointer (triangle) on the bubble edge. */

export type CalloutTailEdge = 'bottom' | 'top' | 'left' | 'right';

export const CALLOUT_TAIL_EDGES: CalloutTailEdge[] = ['bottom', 'right', 'top', 'left'];

export function defaultCalloutTail(): { calloutTailEdge: CalloutTailEdge; calloutTailOffset: number } {
  return { calloutTailEdge: 'bottom', calloutTailOffset: 22 };
}

export function clampTailOffset(o: number): number {
  if (Number.isNaN(o)) return 22;
  return Math.max(6, Math.min(94, o));
}

export function isCalloutTailEdge(s: unknown): s is CalloutTailEdge {
  return s === 'bottom' || s === 'top' || s === 'left' || s === 'right';
}

export function parseCalloutTail(ann: {
  calloutTailEdge?: unknown;
  calloutTailOffset?: unknown;
}): { edge: CalloutTailEdge; offset: number } {
  const edge = isCalloutTailEdge(ann.calloutTailEdge) ? ann.calloutTailEdge : 'bottom';
  const offset =
    typeof ann.calloutTailOffset === 'number' && Number.isFinite(ann.calloutTailOffset)
      ? clampTailOffset(ann.calloutTailOffset)
      : 22;
  return { edge, offset };
}

export function cycleCalloutTailEdge(edge: CalloutTailEdge): CalloutTailEdge {
  const i = CALLOUT_TAIL_EDGES.indexOf(edge);
  return CALLOUT_TAIL_EDGES[(i + 1) % CALLOUT_TAIL_EDGES.length]!;
}

/** Delta along edge in offset-% units from pointer movement (mousedown → mouse). */
export function tailOffsetDeltaFromPointer(
  edge: CalloutTailEdge,
  startClient: { x: number; y: number },
  currentClient: { x: number; y: number },
  rectWidthPx: number,
  rectHeightPx: number
): number {
  const dw = Math.max(1, rectWidthPx);
  const dh = Math.max(1, rectHeightPx);
  switch (edge) {
    case 'bottom':
    case 'top':
      return ((currentClient.x - startClient.x) / dw) * 100;
    case 'left':
    case 'right':
      return ((currentClient.y - startClient.y) / dh) * 100;
    default:
      return 0;
  }
}

/**
 * Given a drag position relative to the callout box center, determine which
 * edge the tail should be on and the offset % along that edge.
 * `relX` / `relY` are the pointer position relative to the box center, in
 * units of half-width / half-height (so the box corners are at ±1, ±1).
 */
export function tailFromPointerAngle(
  relX: number,
  relY: number
): { edge: CalloutTailEdge; offset: number } {
  const ax = Math.abs(relX);
  const ay = Math.abs(relY);

  if (ax < 0.05 && ay < 0.05) {
    return { edge: 'bottom', offset: 50 };
  }

  let edge: CalloutTailEdge;
  let offset: number;

  if (ay >= ax) {
    if (relY > 0) {
      edge = 'bottom';
      offset = 50 + (relX / Math.max(ay, 0.01)) * 50;
    } else {
      edge = 'top';
      offset = 50 + (relX / Math.max(ay, 0.01)) * 50;
    }
  } else {
    if (relX > 0) {
      edge = 'right';
      offset = 50 + (relY / Math.max(ax, 0.01)) * 50;
    } else {
      edge = 'left';
      offset = 50 + (relY / Math.max(ax, 0.01)) * 50;
    }
  }

  return { edge, offset: clampTailOffset(offset) };
}

/** Two absolutely positioned triangles for static HTML export (primary = CSS var). */
export function exportCalloutTailMarkup(edge: CalloutTailEdge, offsetPct: number): string {
  const o = offsetPct;
  const base = 'position:absolute;pointer-events:none;z-index:1;width:0;height:0;';
  if (edge === 'bottom') {
    return (
      `<span aria-hidden="true" style="${base}left:${o}%;top:100%;transform:translateX(-50%);margin-top:1px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid var(--color-primary)"></span>` +
      `<span aria-hidden="true" style="${base}left:${o}%;top:100%;transform:translateX(-50%);margin-top:2px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #0a0a0a"></span>`
    );
  }
  if (edge === 'top') {
    return (
      `<span aria-hidden="true" style="${base}left:${o}%;bottom:100%;transform:translateX(-50%);margin-bottom:1px;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:9px solid var(--color-primary)"></span>` +
      `<span aria-hidden="true" style="${base}left:${o}%;bottom:100%;transform:translateX(-50%);margin-bottom:2px;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid #0a0a0a"></span>`
    );
  }
  if (edge === 'right') {
    return (
      `<span aria-hidden="true" style="${base}top:${o}%;left:100%;transform:translateY(-50%);margin-left:1px;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:9px solid var(--color-primary)"></span>` +
      `<span aria-hidden="true" style="${base}top:${o}%;left:100%;transform:translateY(-50%);margin-left:2px;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid #0a0a0a"></span>`
    );
  }
  return (
    `<span aria-hidden="true" style="${base}top:${o}%;right:100%;transform:translateY(-50%);margin-right:1px;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:9px solid var(--color-primary)"></span>` +
    `<span aria-hidden="true" style="${base}top:${o}%;right:100%;transform:translateY(-50%);margin-right:2px;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:7px solid #0a0a0a"></span>`
  );
}
