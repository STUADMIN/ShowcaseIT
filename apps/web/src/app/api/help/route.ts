import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const guides = await prisma.guide.findMany({
      where: { isDocumentation: true },
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
        _count: { select: { steps: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(guides);
  } catch (error) {
    console.error('Help API error:', error);
    return NextResponse.json({ error: 'Failed to fetch documentation' }, { status: 500 });
  }
}
