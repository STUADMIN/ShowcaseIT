import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import { normalizeSocialPlatformAssetsForDb, parseSocialPlatformAssets } from '@/lib/brand/social-platform-assets';
import { findWorkspaceMembership } from '@/lib/workspaces/workspace-access';

export async function GET(request: NextRequest) {
  const authUserId = await getServerAuthUserId();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId')?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  try {
    const member = await findWorkspaceMembership(workspaceId, authUserId);
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brandKits = await prisma.brandKit.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    await mergeGuideCoverImageUrl(brandKits);
    return NextResponse.json(brandKits);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch brand kits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUserId = await getServerAuthUserId();
  if (!authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { guideCoverImageUrl: coverUrl, videoOutroImageUrl: outroUrl, ...rest } = body as typeof body & {
      guideCoverImageUrl?: string | null;
      videoOutroImageUrl?: string | null;
    };

    const ws =
      typeof rest.workspaceId === 'string' && rest.workspaceId.trim() ? rest.workspaceId.trim() : '';
    if (!ws) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const member = await findWorkspaceMembership(ws, authUserId);
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brandKit = await prisma.brandKit.create({
      data: {
        workspaceId: ws,
        name: rest.name || 'My Brand',
        colorPrimary: rest.colorPrimary,
        colorSecondary: rest.colorSecondary,
        colorAccent: rest.colorAccent,
        colorBackground: rest.colorBackground,
        colorForeground: rest.colorForeground,
        fontHeading: rest.fontHeading,
        fontBody: rest.fontBody,
        logoUrl: rest.logoUrl,
      },
    });

    if ('guideCoverImageUrl' in body) {
      await prisma.$executeRaw`
        UPDATE brand_kits SET guide_cover_image_url = ${coverUrl ?? null} WHERE id = ${brandKit.id}
      `;
    }

    if ('videoOutroImageUrl' in body) {
      const sqlOutro =
        outroUrl === '' || outroUrl === undefined || outroUrl === null ? null : outroUrl;
      await prisma.$executeRaw`
        UPDATE brand_kits SET video_outro_image_url = ${sqlOutro} WHERE id = ${brandKit.id}
      `;
    }

    if ('socialPlatformAssets' in body) {
      const map = parseSocialPlatformAssets(rest.socialPlatformAssets);
      const normalized = normalizeSocialPlatformAssetsForDb(map);
      await prisma.$executeRawUnsafe(
        `UPDATE brand_kits SET social_platform_assets = $1::jsonb WHERE id = $2`,
        JSON.stringify(normalized),
        brandKit.id
      );
    }

    const fresh = await prisma.brandKit.findUnique({ where: { id: brandKit.id } });
    if (!fresh) {
      return NextResponse.json({ error: 'Failed to load brand kit' }, { status: 500 });
    }
    await mergeGuideCoverImageUrl([fresh]);
    return NextResponse.json(fresh, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create brand kit' }, { status: 500 });
  }
}
