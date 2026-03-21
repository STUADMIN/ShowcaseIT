import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const [guidesCount, recordingsCount, projectsCount, recentGuides, recentRecordings] =
      await Promise.all([
        prisma.guide.count(),
        prisma.recording.count(),
        prisma.project.count(),
        prisma.guide.findMany({
          take: 5,
          orderBy: { updatedAt: 'desc' },
          include: { _count: { select: { steps: true } } },
        }),
        prisma.recording.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return NextResponse.json({
      guides: guidesCount,
      recordings: recordingsCount,
      projects: projectsCount,
      recentGuides,
      recentRecordings,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
