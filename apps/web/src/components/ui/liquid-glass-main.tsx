'use client';

import type { CSSProperties, ElementType } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiquidGlassPrefs } from '@/hooks/use-liquid-glass-prefs';
import {
  buildLiquidGlassOrbStyles,
  hexToRgba,
  orbTransitionDuration,
  resolveLiquidGlassColors,
  swirlDurationFor,
} from '@/lib/ui/liquid-glass-prefs';

type Props = {
  children: React.ReactNode;
  className?: string;
  as?: 'main' | 'div';
  contentClassName?: string;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

/**
 * Workspace main area: optional liquid glass + ambient layers (grain, pattern, mesh, spotlight),
 * scroll progress, pointer-linked coords. Prefs persist to your account (Settings → Workspace).
 */
export function LiquidGlassMain({
  children,
  className = '',
  as = 'main',
  contentClassName = 'relative z-[1] min-h-full min-w-0 max-w-full',
}: Props) {
  const { prefs } = useLiquidGlassPrefs();
  const reduceMotion = usePrefersReducedMotion();
  const scrollRef = useRef<HTMLElement | null>(null);
  const [scrollP, setScrollP] = useState(0);

  const [hovered, setHovered] = useState(false);
  const targetRef = useRef({ x: 50, y: 50 });
  const displayRef = useRef({ x: 50, y: 50 });
  const [coords, setCoords] = useState({ x: 50, y: 50 });
  const rafRef = useRef<number | null>(null);

  const Tag: ElementType = as;
  const showLiquid = prefs.effect === 'liquid';
  const trackPointer = showLiquid || prefs.spotlightEnabled;

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!trackPointer) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left + el.scrollLeft;
      const relY = e.clientY - rect.top + el.scrollTop;
      const x = (relX / Math.max(el.scrollWidth, 1)) * 100;
      const y = (relY / Math.max(el.scrollHeight, 1)) * 100;
      targetRef.current = { x, y };

      if (!showLiquid || prefs.pointerFollow !== 'trailing') {
        displayRef.current = { x, y };
        setCoords({ x, y });
      }
    },
    [trackPointer, showLiquid, prefs.pointerFollow]
  );

  useEffect(() => {
    if (!showLiquid || prefs.pointerFollow !== 'trailing') {
      displayRef.current = targetRef.current;
      setCoords({ ...targetRef.current });
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const t = targetRef.current;
      const d = displayRef.current;
      const lerp = 0.11;
      const nx = d.x + (t.x - d.x) * lerp;
      const ny = d.y + (t.y - d.y) * lerp;
      displayRef.current = { x: nx, y: ny };
      setCoords({ x: nx, y: ny });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [showLiquid, prefs.pointerFollow]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !prefs.scrollProgressBar) {
      setScrollP(0);
      return;
    }
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setScrollP(max <= 0 ? 0 : el.scrollTop / max);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    onScroll();
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [prefs.scrollProgressBar]);

  const setScrollEl = useCallback((node: HTMLElement | null) => {
    scrollRef.current = node;
  }, []);

  const orbDur = orbTransitionDuration(prefs.pointerFollow);
  const swirlDur = swirlDurationFor(prefs.swirlSpeed);
  const colors = resolveLiquidGlassColors(prefs);
  const orbStyles = buildLiquidGlassOrbStyles(colors);
  const intMul = Math.max(0.25, Math.min(1, prefs.intensity / 100));
  const layerOpacity = hovered ? Math.min(1, 0.52 + 0.48 * intMul) : Math.min(1, 0.38 * intMul);

  /** `overflow-x-hidden` avoids a bottom horizontal scrollbar (layout shift / scroll “jumping” with progress bar). */
  const outerBase = ['relative', 'flex-1', 'min-w-0', as === 'div' ? 'overflow-x-hidden' : 'overflow-auto overflow-x-hidden', className]
    .filter(Boolean)
    .join(' ');
  const outerFx = `liquid-glass-main ${outerBase}`.trim();
  /** Progress bar + scroll area must stack when the shell is a horizontal flex workspace (guide editor). */
  const tagClassName = [showLiquid ? outerFx : outerBase, as === 'div' && prefs.scrollProgressBar ? 'flex-col' : '']
    .filter(Boolean)
    .join(' ');

  const scrollWrapClass =
    as === 'div'
      ? 'relative flex w-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden'
      : 'relative w-full min-h-full min-w-0 max-w-full overflow-x-hidden';

  const pointerVars = {
    '--lg-x': `${coords.x}%`,
    '--lg-y': `${coords.y}%`,
  } as CSSProperties;

  const hasAmbience =
    prefs.grainEnabled ||
    prefs.backgroundPattern !== 'none' ||
    (prefs.meshDriftEnabled && !reduceMotion) ||
    prefs.spotlightEnabled;

  const meshMul = prefs.meshIntensity / 100;
  const spotMul = prefs.spotlightStrength / 100;

  const renderAmbience = () => {
    if (!hasAmbience) return null;
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[0] overflow-hidden"
        style={prefs.spotlightEnabled ? pointerVars : undefined}
        aria-hidden
      >
        {prefs.meshDriftEnabled && !reduceMotion && (
          <>
            <div
              className="si-ws-mesh si-ws-mesh-a"
              style={{
                opacity: 0.12 + meshMul * 0.2,
                background: `radial-gradient(circle at 40% 40%, ${hexToRgba(colors.primary, 0.38)}, transparent 62%)`,
              }}
            />
            <div
              className="si-ws-mesh si-ws-mesh-b"
              style={{
                opacity: 0.1 + meshMul * 0.18,
                background: `radial-gradient(circle at 60% 55%, ${hexToRgba(colors.secondary, 0.42)}, transparent 58%)`,
              }}
            />
          </>
        )}
        {prefs.backgroundPattern === 'dots' && (
          <div
            className="si-ws-pattern si-ws-pattern-dots absolute inset-0"
            style={{ opacity: prefs.patternOpacity / 100 }}
          />
        )}
        {prefs.backgroundPattern === 'grid' && (
          <div
            className="si-ws-pattern si-ws-pattern-grid absolute inset-0"
            style={{ opacity: prefs.patternOpacity / 100 }}
          />
        )}
        {prefs.grainEnabled && (
          <div
            className="si-ws-grain absolute inset-0"
            style={{ opacity: prefs.grainOpacity / 100 }}
          />
        )}
        {prefs.spotlightEnabled && (
          <div
            className="si-ws-spotlight absolute inset-0"
            style={
              {
                ...pointerVars,
                opacity: 0.35 + spotMul * 0.5,
              } as CSSProperties
            }
          />
        )}
      </div>
    );
  };

  const renderLiquid = () => {
    if (!showLiquid) return null;
    return (
      <div
        className="liquid-glass-layers pointer-events-none absolute inset-0 z-[1] overflow-hidden transition-opacity duration-500 ease-out"
        aria-hidden
        data-active={hovered ? 'true' : 'false'}
        data-swirl={prefs.swirlSpeed === 'off' ? 'off' : 'on'}
        style={
          {
            opacity: layerOpacity,
            ...pointerVars,
            '--lg-orb-duration': orbDur,
            '--lg-shine-duration': orbDur,
            '--lg-swirl-duration': swirlDur === 'none' ? '22s' : swirlDur,
          } as CSSProperties
        }
      >
        <div className="liquid-glass-orb liquid-glass-orb-a" style={orbStyles.orbA} />
        <div className="liquid-glass-orb liquid-glass-orb-b" style={orbStyles.orbB} />
        <div className="liquid-glass-orb liquid-glass-orb-c" style={orbStyles.orbC} />
        <div className="liquid-glass-swirl" style={orbStyles.swirl} />
        <div className="liquid-glass-frost" />
        <div className="liquid-glass-shine" />
      </div>
    );
  };

  return (
    <Tag
      ref={setScrollEl}
      className={tagClassName}
      onMouseMove={trackPointer ? onMove : undefined}
      onMouseEnter={() => trackPointer && setHovered(true)}
      onMouseLeave={() => trackPointer && setHovered(false)}
    >
      {prefs.scrollProgressBar && (
        <div
          className="si-scroll-progress sticky top-0 z-30 h-0.5 w-full shrink-0 basis-auto bg-transparent"
          role="progressbar"
          aria-valuenow={Math.round(scrollP * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="si-scroll-progress-inner h-full origin-left rounded-full bg-gradient-to-r from-brand-500 via-purple-500 to-brand-400"
            style={{ transform: `scaleX(${scrollP})` }}
          />
        </div>
      )}
      <div className={scrollWrapClass}>
        {renderAmbience()}
        {renderLiquid()}
        <div className={contentClassName}>{children}</div>
      </div>
    </Tag>
  );
}
