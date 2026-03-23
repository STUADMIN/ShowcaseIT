import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';

function buildGuideStepPatch(body: Record<string, unknown>): Prisma.GuideStepUpdateInput {
  const data: Prisma.GuideStepUpdateInput = {};
  if (body.title !== undefined) data.title = body.title as string;
  if (body.description !== undefined) data.description = body.description as string;
  if (body.screenshotUrl !== undefined) data.screenshotUrl = body.screenshotUrl as string | null;
  if (body.screenshotOriginalUrl !== undefined) {
    data.screenshotOriginalUrl = body.screenshotOriginalUrl as string | null;
  }
  if (body.styledScreenshotUrl !== undefined) {
    data.styledScreenshotUrl = body.styledScreenshotUrl as string | null;
  }
  if (body.annotations !== undefined) data.annotations = body.annotations as Prisma.InputJsonValue;
  if (body.blurRegions !== undefined) data.blurRegions = body.blurRegions as Prisma.InputJsonValue;
  if (body.mousePosition !== undefined) data.mousePosition = body.mousePosition as Prisma.InputJsonValue;
  if (body.clickTarget !== undefined) data.clickTarget = body.clickTarget as Prisma.InputJsonValue;
  if (typeof body.includeInExport === 'boolean') data.includeInExport = body.includeInExport;
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = buildGuideStepPatch(body);
    if (Object.keys(data).length === 0) {
      const existing = await prisma.guideStep.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Step not found' }, { status: 404 });
      return NextResponse.json(existing);
    }
    const step = await prisma.guideStep.update({
      where: { id },
      data,
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
