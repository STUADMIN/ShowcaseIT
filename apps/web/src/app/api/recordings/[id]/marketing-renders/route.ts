import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db/prisma';
import { isRecordingAccessibleToUser } from '@/lib/recordings/recording-access';
import { createClient } from '@/lib/supabase/server';
import {
  isMarketingRenderModeImplemented,
  MARKETING_RENDER_IMPLEMENTED_MODES,
  parseMarketingRenderMode,
} from '@/lib/marketing-render/modes';
import {
  processMarketingRenderJobStub,
  shouldRunInlineProcessor,
} from '@/lib/marketing-render/process-job';

type PostBody = {
  mode?: string;
  options?: Record<string, unknown>;
};

/**
 * GET — list marketing render jobs for this recording (newest first).
 * Caller must be a member of the recording’s workspace.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ok = await isRecordingAccessibleToUser(recordingId, authUser.id);
    if (!ok) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
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
 * Body: { mode, options? } — session user must be in the recording’s workspace.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordingId } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authId = authUser.id;

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode = parseMarketingRenderMode(body.mode);
  if (!mode) {
    return NextResponse.json(
      {
        error: 'Invalid mode',
        allowed: [...MARKETING_RENDER_IMPLEMENTED_MODES],
      },
      { status: 400 }
    );
  }

  if (!isMarketingRenderModeImplemented(mode)) {
    return NextResponse.json(
      {
        error: `Mode "${mode}" is not available. Only branded screen export can be created from the app right now.`,
        implementedModes: [...MARKETING_RENDER_IMPLEMENTED_MODES],
      },
      { status: 400 }
    );
  }

  try {
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    const canAccess = await isRecordingAccessibleToUser(recordingId, authId);
    if (!canAccess) {
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
        userId: authId,
        mode,
        status: 'queued',
        options: options as Prisma.InputJsonValue,
      },
    });

    if (shouldRunInlineProcessor()) {
      // Do not await: ffmpeg can run for minutes; blocking the POST leaves the UI stuck on "Creating…".
      void processMarketingRenderJobStub(job.id).catch((err) => {
        console.error('[marketing-renders] inline processor failed', job.id, err);
      });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    let message = e instanceof Error ? e.message : 'Failed to create job';
    const hint =
      'Run `npx prisma migrate deploy` (or `migrate dev`) and `npx prisma generate` in apps/web, then restart `next dev`.';
    if (message.includes("reading 'create'") || message.includes('marketingRenderJob')) {
      message = `Prisma client or DB out of sync. ${hint} (${message})`;
    }
    if (message.includes('does not exist') && message.includes('marketing_render')) {
      message = `Table missing. ${hint} (${message})`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
