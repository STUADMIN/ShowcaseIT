export interface Project {
  id: string;
  name: string;
  description?: string;
  brandKitId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: BrandColors;
  fonts: BrandFonts;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  custom: Record<string, string>;
}

export interface BrandFonts {
  heading: string;
  body: string;
  code?: string;
}

export interface Recording {
  id: string;
  projectId: string;
  title: string;
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
  mouseEvents: MouseEvent[];
  clickEvents: ClickEvent[];
  createdAt: Date;
}

export interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
}

export interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
  /** `step-marker` = user pressed “Mark step” during browser recording (no x/y on shared surface). */
  button: 'left' | 'right' | 'middle' | 'step-marker';
  elementText?: string;
}

export interface Guide {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  steps: GuideStep[];
  brandKitId?: string;
  style: GuideStyle;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuideStep {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string;
  /** When false, step is skipped in HTML export. */
  includeInExport?: boolean;
  styledScreenshotUrl?: string;
  annotations: Annotation[];
  blurRegions: BlurRegion[];
  mousePosition?: { x: number; y: number };
  timestamp?: number;
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

export type GuideStyle = 'clean' | 'corporate' | 'modern' | 'minimal';

export type ExportFormat = 'html' | 'pdf' | 'docx' | 'video';

export interface ExportOptions {
  format: ExportFormat;
  brandKitId?: string;
  includeAnimations: boolean;
  embedMode?: 'standalone' | 'iframe';
}

export type SocialPlatform = 'youtube' | 'linkedin' | 'x' | 'facebook' | 'instagram' | 'confluence';

export interface PublishOptions {
  platform: SocialPlatform;
  title: string;
  description: string;
  tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
}

export interface ConfluenceConfig {
  baseUrl: string;
  spaceKey: string;
  parentPageId?: string;
  authToken: string;
  cloudId?: string;
}

export interface ConfluencePublishOptions {
  title: string;
  spaceKey: string;
  parentPageId?: string;
  labels?: string[];
  updateExisting?: boolean;
  existingPageId?: string;
}
