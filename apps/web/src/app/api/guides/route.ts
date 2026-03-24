import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import { EnsureProjectError, ensureProjectForBrand } from '@/lib/projects/ensure-project-for-brand';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const workspaceId = searchParams.get('workspaceId');
  const brandKitIdParam = searchParams.get('brandKitId');
  const forPublish = searchParams.get('forPublish') === '1';
  const publishForUserId = searchParams.get('publishForUserId');

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

    let where: Prisma.GuideWhereInput = {};

    if (forPublish && publishForUserId) {
      /**
       * Publish picker: any guide in a project under a workspace the user belongs to,
       * plus any guide authored as that user (covers tests / id mismatches across envs).
       */
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: publishForUserId },
        select: { workspaceId: true },
      });
      const memberWorkspaceIds = [...new Set(memberships.map((m) => m.workspaceId))];

      const orBranches: Prisma.GuideWhereInput[] = [{ userId: publishForUserId }];
      if (memberWorkspaceIds.length > 0) {
        orBranches.push({ project: { workspaceId: { in: memberWorkspaceIds } } });
      }

      /** Ignore `workspaceId` here so the picker lists every guide you can publish (any member workspace + your authored guides). */
      const publishWhere: Prisma.GuideWhereInput = { OR: orBranches };
      where = projectId ? { AND: [{ projectId }, publishWhere] } : publishWhere;
    } else {
      if (projectId) where.projectId = projectId;
      if (workspaceId) where.project = { workspaceId };
    }

    if (!forPublish && workspaceId && brandKitIdParam?.trim()) {
      const bid = brandKitIdParam.trim();
      const brandWhere: Prisma.GuideWhereInput = {
        OR: [
          { brandKitId: bid },
          { AND: [{ brandKitId: null }, { project: { brandKitId: bid } }] },
        ],
      };
      where =
        Object.keys(where).length > 0 ? { AND: [where, brandWhere] } : brandWhere;
    }

    const guides = await prisma.guide.findMany({
      where,
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

    let projectId = body.projectId as string | undefined;
    let userId = body.userId as string | undefined;
    const workspaceIdForProject = body.workspaceId as string | undefined;
    const brandKitIdForProject = body.brandKitIdForProject as string | undefined;

    if (!projectId && workspaceIdForProject && userId) {
      try {
        const { projectId: ensured } = await ensureProjectForBrand(
          workspaceIdForProject,
          userId,
          typeof brandKitIdForProject === 'string' && brandKitIdForProject.trim()
            ? { brandKitId: brandKitIdForProject.trim() }
            : undefined
        );
        projectId = ensured;
      } catch (e) {
        if (e instanceof EnsureProjectError) {
          return NextResponse.json(
            { error: e.message },
            { status: e.code === 'FORBIDDEN' ? 403 : 404 }
          );
        }
        throw e;
      }
    }

    /**
     * Prefer a project in a workspace the signed-in user belongs to so `userId` matches auth
     * and publish/workspace filters work. Fall back to the oldest project in the DB (legacy)
     * when the client omits `projectId` or the user has no projects yet.
     */
    if (!projectId) {
      if (userId) {
        const inMemberWorkspace = await prisma.project.findFirst({
          where: { workspace: { members: { some: { userId } } } },
          orderBy: { createdAt: 'asc' },
        });
        if (inMemberWorkspace) {
          projectId = inMemberWorkspace.id;
        }
      }
      if (!projectId) {
        const defaultProject = await prisma.project.findFirst({
          orderBy: { createdAt: 'asc' },
          include: { workspace: { include: { members: true } } },
        });
        if (!defaultProject) {
          return NextResponse.json({ error: 'No project found. Create a project first.' }, { status: 400 });
        }
        projectId = defaultProject.id;
      }
    }

    if (!userId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { workspace: { include: { members: true } } },
      });
      userId = project?.workspace.members[0]?.userId;
    }

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: 'Missing projectId or userId. Sign in and try again, or pass userId when creating a guide.' },
        { status: 400 }
      );
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
