import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  marketingJobsDelegateMissing,
  PRISMA_MARKETING_JOBS_HINT,
} from '@/lib/db/prisma-marketing-jobs-guard';
import { parseMarketingRenderMode } from '@/lib/marketing-render/modes';
import {
  processMarketingRenderJobStub,
  shouldRunInlineProcessor,
} from '@/lib/marketing-render/process-job';

type PostBody = {
  userId?: string;
  mode?: string;
  options?: Record<string, unknown>;
};

/**
 * GET — list marketing render jobs for this recording (newest first).
 * Query: userId (must match recording owner).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params;
  const userId = request.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) {
    return NextResponse.json({ error: 'userId query is required' }, { status: 400 });
  }

  try {
    if (marketingJobsDelegateMissing()) {
      return NextResponse.json(
        {
          error: `Marketing export is not wired in this build (Prisma client out of date). ${PRISMA_MARKETING_JOBS_HINT}`,
        },
        { status: 503 }
      );
    }

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: { id: true, userId: true },
    });
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    if (recording.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const jobs = await prisma.marketingRenderJob.findMany({
      where: { recordingId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(jobs);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list jobs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — enqueue a marketing render job.
 * Body: { userId, mode, options? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params;
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const mode = parseMarketingRenderMode(body.mode);
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!mode) {
    return NextResponse.json(
      {
        error: 'Invalid mode',
        allowed: [
          'branded_screen',
          'motion_walkthrough',
          'ai_enhanced',
          'branded_plus_motion',
          'full_stack',
        ],
      },
      { status: 400 }
    );
  }

  try {
    if (marketingJobsDelegateMissing()) {
      return NextResponse.json(
        {
          error: `Marketing export is not wired in this build (Prisma client out of date). ${PRISMA_MARKETING_JOBS_HINT}`,
        },
        { status: 503 }
      );
    }

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    if (recording.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (recording.status !== 'ready' || !recording.videoUrl?.trim()) {
      return NextResponse.json(
        { error: 'Recording must be ready with a video URL before marketing export.' },
        { status: 400 }
      );
    }

    const options =
      body.options && typeof body.options === 'object' && !Array.isArray(body.options)
        ? body.options
        : {};

    const job = await prisma.marketingRenderJob.create({
      data: {
        recordingId,
        userId,
        mode,
        status: 'queued',
        options,
      },
    });

    if (shouldRunInlineProcessor()) {
      await processMarketingRenderJobStub(job.id);
      const updated = await prisma.marketingRenderJob.findUnique({ where: { id: job.id } });
      return NextResponse.json(updated, { status: 201 });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    let message = e instanceof Error ? e.message : 'Failed to create job';
    if (message.includes("reading 'create'") || message.includes('marketingRenderJob')) {
      message = `Database client or schema mismatch. ${PRISMA_MARKETING_JOBS_HINT} Original: ${message}`;
    }
    if (message.includes('does not exist') && message.includes('marketing_render')) {
      message = `Table missing. ${PRISMA_MARKETING_JOBS_HINT} Original: ${message}`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
