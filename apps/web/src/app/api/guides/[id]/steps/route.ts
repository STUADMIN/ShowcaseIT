import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params;
  try {
    const body = await request.json();
    const maxOrder = await prisma.guideStep.aggregate({
      where: { guideId },
      _max: { order: true },
    });
    const step = await prisma.guideStep.create({
      data: {
        guideId,
        order: (maxOrder._max.order ?? 0) + 1,
        title: body.title || `Step ${(maxOrder._max.order ?? 0) + 1}`,
        description: body.description || '',
        screenshotUrl: body.screenshotUrl,
        annotations: body.annotations || [],
        blurRegions: body.blurRegions || [],
        mousePosition: body.mousePosition,
        clickTarget: body.clickTarget,
        timestamp: body.timestamp,
        includeInExport: body.includeInExport ?? true,
      },
    });
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params;
  try {
    const body = await request.json();
    const { steps } = body as { steps: Array<{ id: string; order: number }> };
    await prisma.$transaction(
      steps.map((step) =>
        prisma.guideStep.update({
          where: { id: step.id },
          data: { order: step.order },
        })
      )
    );
    const updated = await prisma.guideStep.findMany({
      where: { guideId },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder steps' }, { status: 500 });
  }
}
