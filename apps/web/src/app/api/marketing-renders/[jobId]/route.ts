import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  marketingJobsDelegateMissing,
  PRISMA_MARKETING_JOBS_HINT,
} from '@/lib/db/prisma-marketing-jobs-guard';

/**
 * GET — job status for polling. Query: userId (must match job owner).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const userId = request.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) {
    return NextResponse.json({ error: 'userId query is required' }, { status: 400 });
  }

  try {
    if (marketingJobsDelegateMissing()) {
      return NextResponse.json(
        {
          error: `Marketing jobs API unavailable (Prisma client out of date). ${PRISMA_MARKETING_JOBS_HINT}`,
        },
        { status: 503 }
      );
    }

    const job = await prisma.marketingRenderJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(job);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
