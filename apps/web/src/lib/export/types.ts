import type { SocialPlatformAssetsMap } from '@/lib/brand/social-platform-assets';

export interface Guide {
  id: string;
  title: string;
  description?: string;
  steps: GuideStep[];
}

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string;
  styledScreenshotUrl?: string;
  annotations: Annotation[];
  blurRegions: BlurRegion[];
  mousePosition?: { x: number; y: number };
}

export interface Annotation {
  id: string;
  type: 'arrow' | 'callout' | 'badge' | 'text' | 'highlight' | 'circle' | 'box';
  x: number;
  y: number;
  /** Arrow end point (percent of image), same coords as x/y */
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  /** Callout pointer: which side of the bubble the triangle sits on */
  calloutTailEdge?: 'bottom' | 'top' | 'left' | 'right';
  /** 0–100: position along that edge (left→right for top/bottom, top→bottom for left/right) */
  calloutTailOffset?: number;
}

export interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
}

export interface BrandKit {
  id: string;
  name: string;
  /** Each value may be `#RRGGBB` or a CSS `linear-gradient` / `radial-gradient` (HTML export). PDF/DOCX use the first hex stop as a flat color. */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  logoUrl?: string;
  /** Brand kit “Guide cover” image — used as export cover sheet when set. */
  guideCoverImageUrl?: string;
  /** Wide banner for HTML/PDF/Word (below guide cover when both exist). */
  exportBannerDocumentUrl?: string;
  /** For link previews / social posts (~1200×627); stored for future Publish integrations. */
  exportBannerSocialUrl?: string;
  /** Optional per-platform logo + banner (YouTube, LinkedIn, X, Facebook, Instagram). */
  socialPlatformAssets?: SocialPlatformAssetsMap;
}
