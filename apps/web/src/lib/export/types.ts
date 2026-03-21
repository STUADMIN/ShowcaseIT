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
  type: 'arrow' | 'callout' | 'badge' | 'text' | 'highlight';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
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
}
