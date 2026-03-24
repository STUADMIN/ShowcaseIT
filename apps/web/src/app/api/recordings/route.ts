import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const workspaceId = searchParams.get('workspaceId');
  const brandKitId = searchParams.get('brandKitId');

  try {
    const where: Prisma.RecordingWhereInput = {};
    if (projectId) {
      where.projectId = projectId;
    } else if (workspaceId) {
      const bid = brandKitId?.trim();
      where.project = bid
        ? { workspaceId, brandKitId: bid }
        : { workspaceId };
    }

    const recordings = await prisma.recording.findMany({
      where: Object.keys(where).length ? where : undefined,
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
  try {
    const body = await request.json();
    const recording = await prisma.recording.create({
      data: {
        projectId: body.projectId,
        userId: body.userId,
        title: body.title || 'Untitled Recording',
        videoUrl: body.videoUrl,
        duration: body.duration || 0,
        width: body.width || 1920,
        height: body.height || 1080,
        mouseEvents: body.mouseEvents || [],
        clickEvents: body.clickEvents || [],
        status: 'processing',
      },
    });
    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create recording' }, { status: 500 });
  }
}
