import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isRecordingAccessibleToUser } from '@/lib/recordings/recording-access';
import { createClient } from '@/lib/supabase/server';

/**
 * GET — job status for polling. Caller must be a member of the job’s recording workspace.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const job = await prisma.marketingRenderJob.findUnique({
      where: { id: jobId },
      select: { id: true, recordingId: true, status: true, mode: true, outputUrl: true, error: true, options: true, createdAt: true, updatedAt: true },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const canAccess = await isRecordingAccessibleToUser(job.recordingId, authUser.id);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(job);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
