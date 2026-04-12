import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceProjectId } = await params;
  try {
    const body = (await request.json()) as {
      targetProjectId: string;
      brandKitId?: string | null;
    };

    if (!body.targetProjectId) {
      return NextResponse.json({ error: 'targetProjectId is required' }, { status: 400 });
    }
    if (body.targetProjectId === sourceProjectId) {
      return NextResponse.json({ error: 'Cannot publish to the same project' }, { status: 400 });
    }

    const [sourceProject, targetProject] = await Promise.all([
      prisma.project.findUnique({ where: { id: sourceProjectId }, select: { id: true } }),
      prisma.project.findUnique({ where: { id: body.targetProjectId }, select: { id: true } }),
    ]);
    if (!sourceProject) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 });
    }
    if (!targetProject) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    const guides = await prisma.guide.findMany({
      where: { projectId: sourceProjectId },
      select: { id: true },
    });

    if (guides.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0 });
    }

    let created = 0;
    let skipped = 0;

    for (const guide of guides) {
      try {
        await prisma.guidePublication.create({
          data: {
            guideId: guide.id,
            projectId: body.targetProjectId,
            brandKitId: body.brandKitId ?? null,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ created, skipped, total: guides.length });
  } catch (error) {
    console.error('Bulk publish error:', error);
    return NextResponse.json({ error: 'Bulk publish failed' }, { status: 500 });
  }
}
