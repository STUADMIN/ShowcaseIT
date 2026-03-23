import { prisma } from '@/lib/db/prisma';

/**
 * Jobs left in `processing` after a crash, hung ffmpeg, or dev-server restart never complete on their own.
 * Call periodically from the worker (and cron) so users can retry.
 */
export async function failStaleMarketingProcessingJobs(): Promise<number> {
  const raw = process.env.MARKETING_RENDER_STALE_PROCESSING_MIN?.trim();
  const parsed = raw ? parseInt(raw, 10) : NaN;
  /** Default 12m: marketing clips should finish sooner; bump via env for very long encodes. */
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const r = await prisma.marketingRenderJob.updateMany({
    where: {
      status: 'processing',
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'failed',
      error: `Processing stalled — no finish within ${minutes} minutes (ffmpeg hang, worker stopped, or dev server restarted). Create a new marketing job, or set MARKETING_RENDER_STALE_PROCESSING_MIN higher for long encodes.`,
    },
  });

  if (r.count > 0) {
    console.warn(`[marketing-render] failed ${r.count} stale processing job(s) (>${minutes}m)`);
  }
  return r.count;
}
