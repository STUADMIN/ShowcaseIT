/**
 * Per-platform logo + banner for social publishing (Brand Kit).
 * Aligns with social platforms listed on the Publish page.
 */

export const SOCIAL_PLATFORM_IDS = ['youtube', 'linkedin', 'x', 'facebook', 'instagram'] as const;
export type SocialPlatformId = (typeof SOCIAL_PLATFORM_IDS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatformId, string> = {
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

export type PlatformSocialAssets = {
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

/** Map of platform id → optional logo/banner URLs */
export type SocialPlatformAssetsMap = Partial<Record<SocialPlatformId, PlatformSocialAssets>>;

export function isSocialPlatformId(value: string): value is SocialPlatformId {
  return (SOCIAL_PLATFORM_IDS as readonly string[]).includes(value);
}

export function parseSocialPlatformAssets(raw: unknown): SocialPlatformAssetsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: SocialPlatformAssetsMap = {};
  for (const id of SOCIAL_PLATFORM_IDS) {
    const v = src[id];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const entry: PlatformSocialAssets = {};
    if (typeof o.logoUrl === 'string' && o.logoUrl.trim()) entry.logoUrl = o.logoUrl.trim();
    if (typeof o.bannerUrl === 'string' && o.bannerUrl.trim()) entry.bannerUrl = o.bannerUrl.trim();
    if (entry.logoUrl || entry.bannerUrl) out[id] = entry;
  }
  return out;
}

/** Serialize for DB: drop empty URLs and empty platform rows */
export function normalizeSocialPlatformAssetsForDb(map: SocialPlatformAssetsMap): SocialPlatformAssetsMap {
  const out: SocialPlatformAssetsMap = {};
  for (const id of SOCIAL_PLATFORM_IDS) {
    const p = map[id];
    if (!p) continue;
    const next: PlatformSocialAssets = {};
    const lu = p.logoUrl?.trim();
    const bu = p.bannerUrl?.trim();
    if (lu) next.logoUrl = lu;
    if (bu) next.bannerUrl = bu;
    if (next.logoUrl || next.bannerUrl) out[id] = next;
  }
  return out;
}

/** Logo for PDF/DOCX/HTML header: platform override → default brand logo */
export function resolveExportLogoUrl(
  defaultLogoUrl: string | undefined | null,
  social: SocialPlatformAssetsMap | undefined | null,
  platform?: SocialPlatformId | null
): string | undefined {
  const trimmedDefault = defaultLogoUrl?.trim();
  if (platform && social?.[platform]?.logoUrl?.trim()) {
    return social[platform]!.logoUrl!.trim();
  }
  return trimmedDefault || undefined;
}

/** og:image style: platform banner → default social banner → document banner */
export function resolveLinkPreviewImageUrl(
  social: SocialPlatformAssetsMap | undefined | null,
  platform: SocialPlatformId | undefined | null,
  exportBannerSocialUrl: string | undefined | null,
  exportBannerDocumentUrl: string | undefined | null
): string {
  if (platform && social?.[platform]?.bannerUrl?.trim()) {
    return social[platform]!.bannerUrl!.trim();
  }
  const s = exportBannerSocialUrl?.trim();
  if (s) return s;
  const d = exportBannerDocumentUrl?.trim();
  return d || '';
}
