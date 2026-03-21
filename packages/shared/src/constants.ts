export const APP_NAME = 'ShowcaseIt';
export const APP_VERSION = '0.1.0';

export const DEFAULT_BRAND_COLORS = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  accent: '#F59E0B',
  background: '#FFFFFF',
  foreground: '#0F172A',
  muted: '#94A3B8',
  custom: {},
} as const;

export const DEFAULT_BRAND_FONTS = {
  heading: 'Inter',
  body: 'Inter',
  code: 'JetBrains Mono',
} as const;

export const GUIDE_STYLES = ['clean', 'corporate', 'modern', 'minimal'] as const;

export const EXPORT_FORMATS = ['html', 'pdf', 'docx', 'video'] as const;

export const SOCIAL_PLATFORMS = ['youtube', 'linkedin', 'x', 'facebook', 'instagram', 'confluence'] as const;

export const MAX_RECORDING_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const FRAME_EXTRACTION_INTERVAL_MS = 100;
export const DEFAULT_BLUR_INTENSITY = 20;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
