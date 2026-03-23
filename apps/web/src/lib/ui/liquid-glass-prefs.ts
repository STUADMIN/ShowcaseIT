import type { CSSProperties } from 'react';

export const LIQUID_GLASS_STORAGE_KEY = 'showcaseit:liquid-glass-prefs';

export type LiquidGlassEffect = 'none' | 'liquid';

export type LiquidGlassPreset = 'ocean' | 'aurora' | 'sunset' | 'forest' | 'mono';

/** How strongly the glow follows the cursor */
export type PointerFollow = 'smooth' | 'snappy' | 'trailing';

export type SwirlSpeed = 'off' | 'slow' | 'medium' | 'fast';

export type BackgroundPattern = 'none' | 'dots' | 'grid';

export interface LiquidGlassPrefs {
  effect: LiquidGlassEffect;
  preset: LiquidGlassPreset;
  /** Override preset primary; null = use preset */
  primary: string | null;
  secondary: string | null;
  /** 25–100, scales overall layer strength */
  intensity: number;
  pointerFollow: PointerFollow;
  swirlSpeed: SwirlSpeed;

  /** Film grain overlay (workspace main area only) */
  grainEnabled: boolean;
  /** 5–45 perceived strength */
  grainOpacity: number;

  backgroundPattern: BackgroundPattern;
  /** 8–50 pattern visibility */
  patternOpacity: number;

  /** Extra slow drifting color blobs under the glass */
  meshDriftEnabled: boolean;
  /** 20–100 */
  meshIntensity: number;

  /** Cursor “flashlight” — brighter near pointer, darker at edges */
  spotlightEnabled: boolean;
  /** 15–70 vignette strength */
  spotlightStrength: number;

  /** Softer colored hover ring on .card / .card-hover */
  cardHoverGlow: boolean;

  /** Thin gradient bar at top of main scroll area */
  scrollProgressBar: boolean;

  /** Fade-in-up on list/grid rows (pages that use .si-stagger-in) */
  listEntranceAnimations: boolean;

  /** Short particle burst when a guide is generated successfully */
  celebrateOnSuccess: boolean;
}

export const LIQUID_GLASS_DEFAULTS: LiquidGlassPrefs = {
  effect: 'liquid',
  preset: 'ocean',
  primary: null,
  secondary: null,
  intensity: 100,
  pointerFollow: 'smooth',
  swirlSpeed: 'medium',

  grainEnabled: false,
  grainOpacity: 18,
  backgroundPattern: 'none',
  patternOpacity: 22,
  meshDriftEnabled: false,
  meshIntensity: 55,
  spotlightEnabled: false,
  spotlightStrength: 38,
  cardHoverGlow: true,
  scrollProgressBar: false,
  listEntranceAnimations: true,
  celebrateOnSuccess: true,
};

export const LIQUID_GLASS_PRESETS: Record<
  LiquidGlassPreset,
  { label: string; primary: string; secondary: string; tertiary: string }
> = {
  ocean: {
    label: 'Ocean (blue / violet)',
    primary: '#60a5fa',
    secondary: '#a855f7',
    tertiary: '#93c5fd',
  },
  aurora: {
    label: 'Aurora (teal / cyan)',
    primary: '#2dd4bf',
    secondary: '#22d3ee',
    tertiary: '#5eead4',
  },
  sunset: {
    label: 'Sunset (coral / pink)',
    primary: '#fb923c',
    secondary: '#f472b6',
    tertiary: '#fcd34d',
  },
  forest: {
    label: 'Forest (emerald / mint)',
    primary: '#4ade80',
    secondary: '#34d399',
    tertiary: '#86efac',
  },
  mono: {
    label: 'Mono (slate glass)',
    primary: '#94a3b8',
    secondary: '#cbd5e1',
    tertiary: '#64748b',
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, '');
  if (!/^[\da-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(96, 165, 250, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function resolveLiquidGlassColors(prefs: LiquidGlassPrefs): {
  primary: string;
  secondary: string;
  tertiary: string;
} {
  const base = LIQUID_GLASS_PRESETS[prefs.preset];
  return {
    primary: prefs.primary?.trim() || base.primary,
    secondary: prefs.secondary?.trim() || base.secondary,
    tertiary: base.tertiary,
  };
}

/** Orb & swirl backgrounds from resolved colors */
export function buildLiquidGlassOrbStyles(colors: {
  primary: string;
  secondary: string;
  tertiary: string;
}): {
  orbA: CSSProperties;
  orbB: CSSProperties;
  orbC: CSSProperties;
  swirl: CSSProperties;
} {
  const { primary, secondary, tertiary } = colors;
  return {
    orbA: {
      background: `radial-gradient(circle at 35% 35%, ${hexToRgba(primary, 0.55)} 0%, ${hexToRgba(primary, 0.22)} 45%, transparent 70%)`,
    },
    orbB: {
      background: `radial-gradient(circle at 60% 50%, ${hexToRgba(secondary, 0.45)} 0%, ${hexToRgba(primary, 0.15)} 50%, transparent 68%)`,
    },
    orbC: {
      background: `radial-gradient(circle at 50% 50%, ${hexToRgba(tertiary, 0.35)} 0%, ${hexToRgba(primary, 0.12)} 55%, transparent 72%)`,
    },
    swirl: {
      background: `conic-gradient(from 220deg at 50% 50%, transparent 0deg, ${hexToRgba(primary, 0.14)} 55deg, ${hexToRgba(secondary, 0.12)} 120deg, ${hexToRgba(tertiary, 0.1)} 200deg, transparent 280deg, ${hexToRgba(primary, 0.08)} 330deg, transparent 360deg)`,
    },
  };
}

export function swirlDurationFor(speed: SwirlSpeed): string | 'none' {
  switch (speed) {
    case 'off':
      return 'none';
    case 'slow':
      return '34s';
    case 'fast':
      return '12s';
    default:
      return '22s';
  }
}

export function orbTransitionDuration(follow: PointerFollow): string {
  switch (follow) {
    case 'snappy':
      return '0.07s';
    case 'trailing':
      return '0.55s';
    default:
      return '0.35s';
  }
}

/** Used when logged out; signed-in users load/save via `/api/users/[id]/preferences`. */
export function loadLiquidGlassPrefs(): LiquidGlassPrefs {
  if (typeof window === 'undefined') return { ...LIQUID_GLASS_DEFAULTS };
  try {
    const raw = localStorage.getItem(LIQUID_GLASS_STORAGE_KEY);
    if (!raw) return { ...LIQUID_GLASS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<LiquidGlassPrefs>;
    return { ...LIQUID_GLASS_DEFAULTS, ...parsed };
  } catch {
    return { ...LIQUID_GLASS_DEFAULTS };
  }
}

export function saveLiquidGlassPrefs(prefs: LiquidGlassPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('showcaseit:liquid-glass-prefs'));
  } catch {
    /* quota / private mode */
  }
}
