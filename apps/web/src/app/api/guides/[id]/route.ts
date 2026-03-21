import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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
      },
    });
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
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
    const body = await request.json();
    const guide = await prisma.guide.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        style: body.style,
        brandKitId: body.brandKitId,
        published: body.published,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
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
