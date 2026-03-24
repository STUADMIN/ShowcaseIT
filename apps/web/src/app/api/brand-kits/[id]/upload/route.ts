import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import {
  isSocialPlatformId,
  normalizeSocialPlatformAssetsForDb,
  parseSocialPlatformAssets,
  type SocialPlatformId,
} from '@/lib/brand/social-platform-assets';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: brandKitId } = await params;
  try {
    const kit = await prisma.brandKit.findUnique({
      where: { id: brandKitId },
      select: { id: true },
    });
    if (!kit) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kind = (formData.get('kind') as string) || 'logo';
    const platformRaw = (formData.get('platform') as string) || '';

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be 2MB or smaller' }, { status: 400 });
    }

    const mime = file.type || 'image/png';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (
      kind !== 'logo' &&
      kind !== 'guideCover' &&
      kind !== 'videoOutro' &&
      kind !== 'exportBannerDocument' &&
      kind !== 'exportBannerSocial' &&
      kind !== 'socialLogo' &&
      kind !== 'socialBanner'
    ) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    if (kind === 'socialLogo' || kind === 'socialBanner') {
      if (!isSocialPlatformId(platformRaw)) {
        return NextResponse.json({ error: 'Invalid or missing platform' }, { status: 400 });
      }
    }

    const ext =
      mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpg'
        : mime.includes('webp')
          ? 'webp'
          : mime.includes('svg')
            ? 'svg'
            : 'png';

    const buffer = Buffer.from(await file.arrayBuffer());
    const platform = platformRaw as SocialPlatformId;
    const storagePath = (() => {
      const base = `brand-kits/${brandKitId}`;
      if (kind === 'logo') return `${base}/logo.${ext}`;
      if (kind === 'guideCover') return `${base}/guide-cover.${ext}`;
      if (kind === 'videoOutro') return `${base}/video-outro.${ext}`;
      if (kind === 'exportBannerDocument') return `${base}/export-banner-doc.${ext}`;
      if (kind === 'exportBannerSocial') return `${base}/export-banner-social.${ext}`;
      if (kind === 'socialLogo') return `${base}/social/${platform}/logo.${ext}`;
      return `${base}/social/${platform}/banner.${ext}`;
    })();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const { error: uploadError } = await supabase.storage.from('screenshots').upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (uploadError) {
      console.error('Brand kit upload:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    if (kind === 'logo') {
      const updated = await prisma.brandKit.update({
        where: { id: brandKitId },
        data: { logoUrl: publicUrl },
      });
      return NextResponse.json(updated);
    }

    if (kind === 'guideCover') {
      await prisma.$executeRaw`
        UPDATE brand_kits SET guide_cover_image_url = ${publicUrl} WHERE id = ${brandKitId}
      `;
      const base = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
      if (!base) {
        return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
      }
      await mergeGuideCoverImageUrl([base]);
      return NextResponse.json({ ...base, guideCoverImageUrl: publicUrl });
    }

    if (kind === 'videoOutro') {
      await prisma.$executeRaw`
        UPDATE brand_kits SET video_outro_image_url = ${publicUrl} WHERE id = ${brandKitId}
      `;
      const base = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
      if (!base) {
        return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
      }
      await mergeGuideCoverImageUrl([base]);
      return NextResponse.json({ ...base, videoOutroImageUrl: publicUrl });
    }

    if (kind === 'exportBannerDocument') {
      await prisma.$executeRaw`
        UPDATE brand_kits SET export_banner_document_url = ${publicUrl} WHERE id = ${brandKitId}
      `;
    } else if (kind === 'exportBannerSocial') {
      await prisma.$executeRaw`
        UPDATE brand_kits SET export_banner_social_url = ${publicUrl} WHERE id = ${brandKitId}
      `;
    } else {
      const rows = await prisma.$queryRaw<Array<{ social_platform_assets: unknown }>>`
        SELECT social_platform_assets FROM brand_kits WHERE id = ${brandKitId} LIMIT 1
      `;
      const current = parseSocialPlatformAssets(rows[0]?.social_platform_assets);
      const merged: typeof current = {
        ...current,
        [platform]: {
          ...current[platform],
          ...(kind === 'socialLogo' ? { logoUrl: publicUrl } : { bannerUrl: publicUrl }),
        },
      };
      const next = normalizeSocialPlatformAssetsForDb(merged);
      await prisma.$executeRawUnsafe(
        `UPDATE brand_kits SET social_platform_assets = $1::jsonb WHERE id = $2`,
        JSON.stringify(next),
        brandKitId
      );
    }

    const base = await prisma.brandKit.findUnique({ where: { id: brandKitId } });
    if (!base) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }
    await mergeGuideCoverImageUrl([base]);
    return NextResponse.json(base);
  } catch (e) {
    console.error('Brand kit upload route error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
