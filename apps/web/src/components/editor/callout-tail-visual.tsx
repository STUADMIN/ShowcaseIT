'use client';

import type { CalloutTailEdge } from '@/lib/editor/callout-tail';

interface CalloutTailVisualProps {
  edge: CalloutTailEdge;
  offsetPct: number;
  /** When true, show a small handle users can grab (Tail tool). */
  showAdjustHandle?: boolean;
}

/**
 * Two-layer CSS triangle (border + fill) on the chosen side of the callout bubble.
 */
export function CalloutTailVisual({ edge, offsetPct, showAdjustHandle }: CalloutTailVisualProps) {
  const o = offsetPct;

  const outerBase = 'absolute z-[1] block h-0 w-0';
  const innerBase = 'absolute z-[1] block h-0 w-0';

  const outer =
    edge === 'bottom' ? (
      <span
        className={`${outerBase} border-x-[7px] border-t-[9px] border-x-transparent border-t-brand-400`}
        style={{ left: `${o}%`, top: '100%', transform: 'translateX(-50%)', marginTop: 1 }}
        aria-hidden
      />
    ) : edge === 'top' ? (
      <span
        className={`${outerBase} border-x-[7px] border-b-[9px] border-x-transparent border-b-brand-400`}
        style={{ left: `${o}%`, bottom: '100%', transform: 'translateX(-50%)', marginBottom: 1 }}
        aria-hidden
      />
    ) : edge === 'right' ? (
      <span
        className={`${outerBase} border-y-[7px] border-l-[9px] border-y-transparent border-l-brand-400`}
        style={{ top: `${o}%`, left: '100%', transform: 'translateY(-50%)', marginLeft: 1 }}
        aria-hidden
      />
    ) : (
      <span
        className={`${outerBase} border-y-[7px] border-r-[9px] border-y-transparent border-r-brand-400`}
        style={{ top: `${o}%`, right: '100%', transform: 'translateY(-50%)', marginRight: 1 }}
        aria-hidden
      />
    );

  const inner =
    edge === 'bottom' ? (
      <span
        className={`${innerBase} border-x-[5px] border-t-[7px] border-x-transparent border-t-gray-950`}
        style={{ left: `${o}%`, top: '100%', transform: 'translateX(-50%)', marginTop: 2 }}
        aria-hidden
      />
    ) : edge === 'top' ? (
      <span
        className={`${innerBase} border-x-[5px] border-b-[7px] border-x-transparent border-b-gray-950`}
        style={{ left: `${o}%`, bottom: '100%', transform: 'translateX(-50%)', marginBottom: 2 }}
        aria-hidden
      />
    ) : edge === 'right' ? (
      <span
        className={`${innerBase} border-y-[5px] border-l-[7px] border-y-transparent border-l-gray-950`}
        style={{ top: `${o}%`, left: '100%', transform: 'translateY(-50%)', marginLeft: 2 }}
        aria-hidden
      />
    ) : (
      <span
        className={`${innerBase} border-y-[5px] border-r-[7px] border-y-transparent border-r-gray-950`}
        style={{ top: `${o}%`, right: '100%', transform: 'translateY(-50%)', marginRight: 2 }}
        aria-hidden
      />
    );

  return (
    <>
      {outer}
      {inner}
      {showAdjustHandle ? (
        <span
          className="absolute z-[3] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-300 bg-gray-900/90 shadow-md pointer-events-none"
          style={
            edge === 'bottom'
              ? { left: `${o}%`, top: 'calc(100% + 10px)' }
              : edge === 'top'
                ? { left: `${o}%`, bottom: 'calc(100% + 10px)' }
                : edge === 'right'
                  ? { left: 'calc(100% + 10px)', top: `${o}%` }
                  : { right: 'calc(100% + 10px)', top: `${o}%` }
          }
          title="Drag on bubble to slide; double-click bubble to rotate tail"
          aria-hidden
        />
      ) : null}
    </>
  );
}
