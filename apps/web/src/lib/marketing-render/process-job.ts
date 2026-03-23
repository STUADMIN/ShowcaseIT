import { prisma } from '@/lib/db/prisma';
import type { MarketingRenderMode } from '@/lib/marketing-render/modes';
import { executeMarketingRenderJob } from '@/lib/marketing-render/run-job';

/**
 * Entry point for cron / inline flag / CLI worker.
 * Runs real ffmpeg + upload when `MARKETING_RENDER_USE_STUB` is not set.
 */
export async function processMarketingRenderJobStub(jobId: string): Promise<void> {
  if (process.env.MARKETING_RENDER_USE_STUB === '1') {
    await markStubFailed(jobId);
    return;
  }
  await executeMarketingRenderJob(jobId);
}

async function markStubFailed(jobId: string): Promise<void> {
  const job = await prisma.marketingRenderJob.findUnique({
    where: { id: jobId },
    include: { recording: true },
  });

  if (!job || job.status !== 'queued' || !job.recording) return;

  await prisma.marketingRenderJob.update({
    where: { id: jobId },
    data: { status: 'processing', error: null },
  });

  const hint =
    'MARKETING_RENDER_USE_STUB=1: processor disabled. Unset it or run `npm run worker:marketing` from apps/web.';

  await prisma.marketingRenderJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error: hint,
    },
  });
}

/** Local dev: kick ffmpeg after POST without a separate worker (runs in background; POST still returns immediately). */
export function shouldRunInlineProcessor(): boolean {
  return process.env.MARKETING_RENDER_INLINE === '1';
}

export function describePipeline(mode: MarketingRenderMode): string[] {
  const steps: string[] = [];
  if (
    mode === 'branded_screen' ||
    mode === 'branded_plus_motion' ||
    mode === 'full_stack'
  ) {
    steps.push('Branded ffmpeg pass (letterbox + Brand Kit pad color → H.264 MP4)');
  }
  if (
    mode === 'motion_walkthrough' ||
    mode === 'branded_plus_motion' ||
    mode === 'full_stack'
  ) {
    steps.push('Motion replay renderer (cursor + highlights from clickEvents)');
  }
  if (mode === 'ai_enhanced' || mode === 'full_stack') {
    steps.push('AI style / treatment via ai-service (optional)');
  }
  if (mode === 'motion_walkthrough') {
    steps.push('(Screen recording used as reference or background)');
  }
  if (mode === 'ai_enhanced') {
    steps.unshift('Requires a base render or raw video as input');
  }
  return steps;
}
