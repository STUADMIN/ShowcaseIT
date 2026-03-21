import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    const guides = await prisma.guide.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        steps: { orderBy: { order: 'asc' } },
        brandKit: true,
        _count: { select: { steps: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(guides);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch guides' }, { status: 500 });
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
