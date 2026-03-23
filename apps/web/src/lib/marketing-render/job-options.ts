/**
 * Parsed marketing render job `options` JSON (see MARKETING_RENDERS.md).
 */
export type MarketingBannerPosition = 'none' | 'top' | 'bottom';

export type ParsedMarketingJobOptions = {
  maxSeconds: number;
  bannerPosition: MarketingBannerPosition;
  /** When true, overlay project's Brand Kit logo on the banner (requires logoUrl on brand kit). */
  bannerLogoFromBrandKit: boolean;
  /** Banner strip height in px (clamped). */
  bannerHeightPx: number;
};

const BANNER_HEIGHT_MIN = 48;
const BANNER_HEIGHT_MAX = 200;
const BANNER_HEIGHT_DEFAULT = 96;

export function parseMarketingJobOptions(raw: unknown): ParsedMarketingJobOptions {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const maxRaw = o.maxSeconds;
  const n = typeof maxRaw === 'number' ? maxRaw : Number(maxRaw);
  const maxSeconds = !Number.isFinite(n) || n < 10 ? 180 : Math.min(600, Math.floor(n));

  const bp = o.bannerPosition;
  let bannerPosition: MarketingBannerPosition = 'none';
  if (bp === 'top' || bp === 'bottom') bannerPosition = bp;

  const logoRaw = o.bannerLogoFromBrandKit;
  const bannerLogoFromBrandKit =
    logoRaw === true || logoRaw === 'true' || logoRaw === 1 || logoRaw === '1';

  const bhRaw = o.bannerHeightPx;
  const bh = typeof bhRaw === 'number' ? bhRaw : Number(bhRaw);
  let bannerHeightPx = BANNER_HEIGHT_DEFAULT;
  if (Number.isFinite(bh)) {
    bannerHeightPx = Math.min(BANNER_HEIGHT_MAX, Math.max(BANNER_HEIGHT_MIN, Math.floor(bh)));
  }

  return {
    maxSeconds,
    bannerPosition,
    bannerLogoFromBrandKit,
    bannerHeightPx,
  };
}
