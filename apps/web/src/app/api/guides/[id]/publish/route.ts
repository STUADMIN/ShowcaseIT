import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const publications = await prisma.guidePublication.findMany({
      where: { guideId: id },
      include: {
        project: { select: { id: true, name: true, brandKit: { select: { id: true, name: true } } } },
        brandKit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(publications);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch publications' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params;
  try {
    const body = (await request.json()) as {
      projectId: string;
      brandKitId?: string | null;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const guide = await prisma.guide.findUnique({ where: { id: guideId }, select: { id: true, projectId: true } });
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    if (guide.projectId === body.projectId) {
      return NextResponse.json({ error: 'Cannot publish a guide to its own project' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: body.projectId }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    const publication = await prisma.guidePublication.upsert({
      where: { guideId_projectId: { guideId, projectId: body.projectId } },
      create: {
        guideId,
        projectId: body.projectId,
        brandKitId: body.brandKitId ?? null,
      },
      update: {
        brandKitId: body.brandKitId ?? null,
      },
      include: {
        project: { select: { id: true, name: true, brandKit: { select: { id: true, name: true } } } },
        brandKit: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(publication, { status: 201 });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: 'Failed to publish guide' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const pubId = searchParams.get('publicationId');

    if (!pubId) {
      return NextResponse.json({ error: 'publicationId query param is required' }, { status: 400 });
    }

    await prisma.guidePublication.delete({
      where: { id: pubId, guideId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to unpublish' }, { status: 500 });
  }
}
