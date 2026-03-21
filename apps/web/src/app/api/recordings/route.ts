import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    const recordings = await prisma.recording.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'desc' },
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
