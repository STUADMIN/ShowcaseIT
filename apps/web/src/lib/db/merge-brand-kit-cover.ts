import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';
import { parseSocialPlatformAssets, type SocialPlatformAssetsMap } from '@/lib/brand/social-platform-assets';

/** Brand kit rows that should receive merged image URLs from SQL (works if Prisma Client omits newer columns). */
export type BrandKitMergeTarget = {
  id: string;
  guideCoverImageUrl?: string | null;
  videoOutroImageUrl?: string | null;
  exportBannerDocumentUrl?: string | null;
  exportBannerSocialUrl?: string | null;
  /** Prisma returns `JsonValue`; after merge this is replaced with a parsed map. */
  socialPlatformAssets?: SocialPlatformAssetsMap | Prisma.JsonValue | null;
};

/**
 * Fills optional image URLs from DB so API responses work even when the generated
 * Prisma Client predates newer columns.
 */
export async function mergeGuideCoverImageUrl(kits: BrandKitMergeTarget[]): Promise<void> {
  if (kits.length === 0) return;
  const uniqueIds = [...new Set(kits.map((k) => k.id))];
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      guide_cover_image_url: string | null;
      video_outro_image_url: string | null;
      export_banner_document_url: string | null;
      export_banner_social_url: string | null;
      social_platform_assets: unknown;
    }>
  >(
    Prisma.sql`SELECT id, guide_cover_image_url, video_outro_image_url, export_banner_document_url, export_banner_social_url, social_platform_assets FROM brand_kits WHERE id IN (${Prisma.join(
      uniqueIds.map((id) => Prisma.sql`${id}`)
    )})`
  );
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const k of kits) {
    const r = map.get(k.id);
    if (!r) continue;
    k.guideCoverImageUrl = r.guide_cover_image_url ?? null;
    k.videoOutroImageUrl = r.video_outro_image_url ?? null;
    k.exportBannerDocumentUrl = r.export_banner_document_url ?? null;
    k.exportBannerSocialUrl = r.export_banner_social_url ?? null;
    k.socialPlatformAssets = parseSocialPlatformAssets(r.social_platform_assets);
  }
}
