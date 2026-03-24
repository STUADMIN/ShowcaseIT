import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import { isUserMemberOfProjectWorkspace } from '@/lib/projects/verify-project-access';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const guide = await prisma.guide.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        brandKit: true,
        recording: true,
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
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }
    if (guide.brandKit) {
      await mergeGuideCoverImageUrl([guide.brandKit]);
    }
    if (guide.project?.brandKit) {
      await mergeGuideCoverImageUrl([guide.project.brandKit]);
    }
    return NextResponse.json(guide);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch guide' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      userId?: string;
      title?: string;
      description?: string | null;
      style?: string;
      brandKitId?: string | null;
      projectId?: string;
      published?: boolean;
    };

    const existing = await prisma.guide.findUnique({
      where: { id },
      select: { userId: true, projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    const nextProjectId =
      body.projectId !== undefined ? body.projectId : existing.projectId;
    const changingProject =
      body.projectId !== undefined && body.projectId !== existing.projectId;
    const changingBrand = body.brandKitId !== undefined;

    if ((changingProject || changingBrand) && !body.userId?.trim()) {
      return NextResponse.json(
        { error: 'userId is required when changing project or brand kit.' },
        { status: 400 }
      );
    }
    const uid = body.userId?.trim() ?? '';
    if ((changingProject || changingBrand) && existing.userId !== uid) {
      return NextResponse.json({ error: 'Not allowed to change this guide.' }, { status: 403 });
    }

    if (changingProject) {
      const ok = await isUserMemberOfProjectWorkspace(uid, nextProjectId);
      if (!ok) {
        return NextResponse.json(
          { error: 'That project was not found or you are not a member of its workspace.' },
          { status: 403 }
        );
      }
    }

    const data: Prisma.GuideUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.style !== undefined) data.style = body.style;
    if (body.published !== undefined) data.published = body.published;
    if (changingProject) {
      data.project = { connect: { id: nextProjectId } };
    }

    if (body.brandKitId !== undefined) {
      if (body.brandKitId === null || body.brandKitId === '') {
        data.brandKit = { disconnect: true };
      } else {
        const proj = await prisma.project.findUnique({
          where: { id: nextProjectId },
          select: { workspaceId: true },
        });
        if (!proj) {
          return NextResponse.json({ error: 'Invalid project' }, { status: 400 });
        }
        const kit = await prisma.brandKit.findFirst({
          where: { id: body.brandKitId, workspaceId: proj.workspaceId },
        });
        if (!kit) {
          return NextResponse.json(
            { error: 'Brand kit not found in this guide’s workspace.' },
            { status: 400 }
          );
        }
        data.brandKit = { connect: { id: body.brandKitId } };
      }
    }

    const guide = await prisma.guide.update({
      where: { id },
      data,
      include: {
        steps: { orderBy: { order: 'asc' } },
        brandKit: true,
        recording: true,
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
    if (guide.brandKit) {
      await mergeGuideCoverImageUrl([guide.brandKit]);
    }
    if (guide.project?.brandKit) {
      await mergeGuideCoverImageUrl([guide.project.brandKit]);
    }
    return NextResponse.json(guide);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update guide' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.guide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete guide' }, { status: 500 });
  }
}
