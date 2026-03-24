/**
 * Marketing render modes — one job per mode per request; combine modes via presets below.
 */
export const MARKETING_RENDER_MODES = [
  'branded_screen',
  'motion_walkthrough',
  'ai_enhanced',
  'branded_plus_motion',
  'full_stack',
] as const;

export type MarketingRenderMode = (typeof MARKETING_RENDER_MODES)[number];

/**
 * Modes the app allows when **creating** jobs (POST). The worker can still finish older queued jobs
 * for other modes; we only expose branded screen in the UI because the other pipelines are not reliable enough yet.
 */
export const MARKETING_RENDER_IMPLEMENTED_MODES = ['branded_screen'] as const satisfies readonly MarketingRenderMode[];

export function isMarketingRenderModeImplemented(mode: MarketingRenderMode): boolean {
  return (MARKETING_RENDER_IMPLEMENTED_MODES as readonly string[]).includes(mode);
}

export const MARKETING_RENDER_MODE_LABELS: Record<MarketingRenderMode, string> = {
  branded_screen: 'Branded screen recording (ffmpeg + Brand Kit)',
  motion_walkthrough: 'Animated walkthrough (cursor / steps → video)',
  ai_enhanced: 'AI style pass (on top of another render)',
  branded_plus_motion: 'Branded screen + motion highlights',
  full_stack: 'Branded + motion + AI (longest pipeline)',
};

export function parseMarketingRenderMode(raw: unknown): MarketingRenderMode | null {
  if (typeof raw !== 'string') return null;
  return (MARKETING_RENDER_MODES as readonly string[]).includes(raw)
    ? (raw as MarketingRenderMode)
    : null;
}
