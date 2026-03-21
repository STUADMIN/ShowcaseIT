import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const step = await prisma.guideStep.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        screenshotUrl: body.screenshotUrl,
        styledScreenshotUrl: body.styledScreenshotUrl,
        annotations: body.annotations,
        blurRegions: body.blurRegions,
        mousePosition: body.mousePosition,
        clickTarget: body.clickTarget,
        includeInExport: body.includeInExport,
      },
    });
    return NextResponse.json(step);
  } catch {
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.guideStep.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 });
  }
}
