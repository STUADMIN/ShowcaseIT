import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import { normalizeSocialPlatformAssetsForDb, parseSocialPlatformAssets } from '@/lib/brand/social-platform-assets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const brandKit = await prisma.brandKit.findUnique({ where: { id } });
    if (!brandKit) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }
    await mergeGuideCoverImageUrl([brandKit]);
    return NextResponse.json(brandKit);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch brand kit' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { guideCoverImageUrl: coverUrl, ...rest } = body as Record<string, unknown> & {
      guideCoverImageUrl?: string | null;
    };

    await prisma.brandKit.update({
      where: { id },
      data: {
        name: rest.name as string | undefined,
        colorPrimary: rest.colorPrimary as string | undefined,
        colorSecondary: rest.colorSecondary as string | undefined,
        colorAccent: rest.colorAccent as string | undefined,
        colorBackground: rest.colorBackground as string | undefined,
        colorForeground: rest.colorForeground as string | undefined,
        fontHeading: rest.fontHeading as string | undefined,
        fontBody: rest.fontBody as string | undefined,
        logoUrl: rest.logoUrl as string | null | undefined,
      },
    });

    if ('guideCoverImageUrl' in body) {
      await prisma.$executeRaw`
        UPDATE brand_kits SET guide_cover_image_url = ${coverUrl ?? null} WHERE id = ${id}
      `;
    }

    if ('exportBannerDocumentUrl' in body) {
      const v = rest.exportBannerDocumentUrl as string | null | undefined;
      const sqlVal = v === '' || v === undefined ? null : v;
      await prisma.$executeRaw`
        UPDATE brand_kits SET export_banner_document_url = ${sqlVal} WHERE id = ${id}
      `;
    }
    if ('exportBannerSocialUrl' in body) {
      const v = rest.exportBannerSocialUrl as string | null | undefined;
      const sqlVal = v === '' || v === undefined ? null : v;
      await prisma.$executeRaw`
        UPDATE brand_kits SET export_banner_social_url = ${sqlVal} WHERE id = ${id}
      `;
    }

    if ('socialPlatformAssets' in body) {
      const map = parseSocialPlatformAssets(rest.socialPlatformAssets);
      const normalized = normalizeSocialPlatformAssetsForDb(map);
      await prisma.$executeRawUnsafe(
        `UPDATE brand_kits SET social_platform_assets = $1::jsonb WHERE id = $2`,
        JSON.stringify(normalized),
        id
      );
    }

    const fresh = await prisma.brandKit.findUnique({ where: { id } });
    if (!fresh) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }
    await mergeGuideCoverImageUrl([fresh]);
    return NextResponse.json(fresh);
  } catch {
    return NextResponse.json({ error: 'Failed to update brand kit' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.brandKit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete brand kit' }, { status: 500 });
  }
}
