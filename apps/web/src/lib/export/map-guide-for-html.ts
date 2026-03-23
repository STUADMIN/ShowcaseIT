import type { BrandKit, Guide, GuideStep } from './types';
import type { BrandKit as PrismaBrandKit, GuideStep as PrismaGuideStep } from '@/generated/prisma';
import { parseSocialPlatformAssets } from '@/lib/brand/social-platform-assets';

function parseAnnotations(raw: unknown): GuideStep['annotations'] {
  return Array.isArray(raw) ? (raw as GuideStep['annotations']) : [];
}

function parseBlurRegions(raw: unknown): GuideStep['blurRegions'] {
  return Array.isArray(raw) ? (raw as GuideStep['blurRegions']) : [];
}

function parseMousePosition(raw: unknown): GuideStep['mousePosition'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return undefined;
  return { x: o.x, y: o.y };
}

export function mapPrismaStepToExportStep(s: PrismaGuideStep): GuideStep {
  return {
    id: s.id,
    order: s.order,
    title: s.title,
    description: s.description || '',
    screenshotUrl: s.screenshotUrl || '',
    styledScreenshotUrl: s.styledScreenshotUrl ?? undefined,
    annotations: parseAnnotations(s.annotations),
    blurRegions: parseBlurRegions(s.blurRegions),
    mousePosition: parseMousePosition(s.mousePosition),
  };
}

/** Includes export banner + social JSON (may be absent on older generated Prisma clients). */
export type PrismaBrandKitForExport = PrismaBrandKit & {
  exportBannerDocumentUrl?: string | null;
  exportBannerSocialUrl?: string | null;
  socialPlatformAssets?: unknown;
};

export function mapPrismaBrandKit(bk: PrismaBrandKitForExport): BrandKit {
  return {
    id: bk.id,
    name: bk.name,
    colors: {
      primary: bk.colorPrimary,
      secondary: bk.colorSecondary,
      accent: bk.colorAccent,
      background: bk.colorBackground,
      foreground: bk.colorForeground,
    },
    fonts: {
      heading: bk.fontHeading,
      body: bk.fontBody,
    },
    logoUrl: bk.logoUrl ?? undefined,
    guideCoverImageUrl: bk.guideCoverImageUrl ?? undefined,
    exportBannerDocumentUrl: bk.exportBannerDocumentUrl ?? undefined,
    exportBannerSocialUrl: bk.exportBannerSocialUrl ?? undefined,
    socialPlatformAssets: parseSocialPlatformAssets(bk.socialPlatformAssets),
  };
}

export function buildExportGuide(
  guide: { id: string; title: string; description: string | null },
  steps: PrismaGuideStep[]
): Guide {
  return {
    id: guide.id,
    title: guide.title,
    description: guide.description ?? undefined,
    steps: steps.map(mapPrismaStepToExportStep),
  };
}
