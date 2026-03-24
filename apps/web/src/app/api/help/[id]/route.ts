import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const guide = await prisma.guide.findFirst({
      where: { id, isDocumentation: true },
      include: {
        steps: {
          where: { includeInExport: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            title: true,
            description: true,
            screenshotUrl: true,
            styledScreenshotUrl: true,
          },
        },
      },
    });

    if (!guide) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(guide);
  } catch (error) {
    console.error('Help article API error:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}
