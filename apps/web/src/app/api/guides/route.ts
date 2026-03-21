import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    /**
     * Omit `guideCoverImageUrl` from Prisma `select` so a stale generated client
     * (e.g. `npx prisma generate` failed with EPERM) still runs. We merge cover
     * URLs from SQL below — same DB column `guide_cover_image_url`.
     */
    const brandSelect = {
      id: true,
      name: true,
      logoUrl: true,
      colorPrimary: true,
      colorSecondary: true,
      colorAccent: true,
      colorBackground: true,
    } as const;

    const guides = await prisma.guide.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        /** First step only — used for list card cover (avoid loading all steps). */
        steps: {
          orderBy: { order: 'asc' },
          take: 1,
          select: { screenshotUrl: true, styledScreenshotUrl: true },
        },
        brandKit: { select: brandSelect },
        project: { select: { brandKit: { select: brandSelect } } },
        _count: { select: { steps: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const nestedKits: Array<{ id: string; guideCoverImageUrl?: string | null }> = [];
    for (const g of guides) {
      if (g.brandKit) nestedKits.push(g.brandKit);
      if (g.project?.brandKit) nestedKits.push(g.project.brandKit);
    }
    await mergeGuideCoverImageUrl(nestedKits);

    return NextResponse.json(guides);
  } catch (error) {
    console.error('[GET /api/guides]', error);
    const hint =
      process.env.NODE_ENV === 'development' && error instanceof Error ? `: ${error.message}` : '';
    return NextResponse.json(
      { error: `Failed to fetch guides${hint}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let projectId = body.projectId;
    let userId = body.userId;

    if (!projectId || !userId) {
      const defaultProject = await prisma.project.findFirst({
        orderBy: { createdAt: 'asc' },
        include: { workspace: { include: { members: true } } },
      });

      if (!defaultProject) {
        return NextResponse.json({ error: 'No project found. Create a project first.' }, { status: 400 });
      }

      projectId = projectId || defaultProject.id;
      userId = userId || defaultProject.workspace.members[0]?.userId;
    }

    const guide = await prisma.guide.create({
      data: {
        projectId,
        userId,
        title: body.title || 'Untitled Guide',
        description: body.description,
        style: body.style || 'clean',
        brandKitId: body.brandKitId,
        recordingId: body.recordingId,
      },
      include: { steps: true },
    });
    return NextResponse.json(guide, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 });
  }
}
