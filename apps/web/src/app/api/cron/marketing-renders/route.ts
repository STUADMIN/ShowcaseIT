import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { processMarketingRenderJobStub } from '@/lib/marketing-render/process-job';
import { failStaleMarketingProcessingJobs } from '@/lib/marketing-render/stale-jobs';

const CRON_HEADER = 'authorization';

/**
 * Drain one queued marketing render job (stub processor until ffmpeg/Remotion worker is wired).
 * Vercel Cron: add to vercel.json pointing at this path; set CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  const auth = request.headers.get(CRON_HEADER);
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : auth?.trim();
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.VERCEL === '1' && process.env.MARKETING_RENDER_VERCEL !== '1') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message:
        'Cron skips ffmpeg on Vercel by default. Run the worker (`npm run worker:marketing` in apps/web) against the same DATABASE_URL, or set MARKETING_RENDER_VERCEL=1.',
    });
  }

  try {
    await failStaleMarketingProcessingJobs();

    const job = await prisma.marketingRenderJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    if (!job) {
      return NextResponse.json({ ok: true, processed: 0, message: 'No queued jobs' });
    }
    await processMarketingRenderJobStub(job.id);
    const updated = await prisma.marketingRenderJob.findUnique({ where: { id: job.id } });
    return NextResponse.json({ ok: true, processed: 1, job: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
