import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';
import { orgKeyForProjectId } from '@/lib/db/org-key';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authId = authUser.id;
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const workspaceId = searchParams.get('workspaceId');
  const brandKitId = searchParams.get('brandKitId');

  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: authId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    /**
     * List: everything in workspaces you belong to, plus any recording you authored (`userId`).
     * That way your own captures still appear if project/workspace membership data is wrong or legacy.
     */
    const visibilityScope: Prisma.RecordingWhereInput =
      workspaceIds.length > 0
        ? {
            OR: [
              { userId: authId },
              { project: { workspaceId: { in: workspaceIds } } },
            ],
          }
        : { userId: authId };

    let extra: Prisma.RecordingWhereInput = {};

    if (projectId) {
      const allowed = await prisma.project.findFirst({
        where: {
          id: projectId,
          workspace: { members: { some: { userId: authId } } },
        },
        select: { id: true },
      });
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      extra = { projectId };
    } else if (workspaceId) {
      if (!workspaceIds.includes(workspaceId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const bid = brandKitId?.trim();
      if (bid) {
        /**
         * New captures use a project with `brandKitId` set. Older / “All brands” flows used
         * `ensureProjectForBrand` without a kit → “Main” with `brandKitId: null`. Guides GET
         * already OR-matches null guide + project kit; recordings only have the project.
         * When this workspace has exactly one kit and the filter is that kit, include
         * unassigned projects so those recordings still appear under the brand filter.
         */
        const kitsInWs = await prisma.brandKit.findMany({
          where: { workspaceId },
          select: { id: true },
          take: 2,
        });
        const onlyKit = kitsInWs.length === 1 ? kitsInWs[0] : null;
        const mergeUnassigned = onlyKit?.id === bid;
        extra = {
          project: mergeUnassigned
            ? { workspaceId, OR: [{ brandKitId: bid }, { brandKitId: null }] }
            : { workspaceId, brandKitId: bid },
        };
      } else {
        extra = { project: { workspaceId } };
      }
    }

    const where: Prisma.RecordingWhereInput =
      Object.keys(extra).length > 0 ? { AND: [visibilityScope, extra] } : visibilityScope;

    const recordings = await prisma.recording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
            brandKitId: true,
            brandKit: { select: { id: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json(recordings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authId = authUser.id;

  try {
    const body = await request.json();
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (body.userId !== authId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = await prisma.project.findFirst({
      where: {
        id: body.projectId,
        workspace: { members: { some: { userId: authId } } },
      },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json(
        { error: 'Project not found or you are not a member of its workspace.' },
        { status: 403 }
      );
    }

    const orgKey = await orgKeyForProjectId(body.projectId);
    const recording = await prisma.recording.create({
      data: {
        projectId: body.projectId,
        userId: authId,
        title: body.title || 'Untitled Recording',
        videoUrl: body.videoUrl,
        duration: body.duration || 0,
        width: body.width || 1920,
        height: body.height || 1080,
        mouseEvents: body.mouseEvents || [],
        clickEvents: body.clickEvents || [],
        status: 'processing',
        orgKey,
      },
    });
    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create recording' }, { status: 500 });
  }
}
