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

/**
 * After POST, kick ffmpeg inside the Next process (fire-and-forget; POST still returns immediately).
 * - `MARKETING_RENDER_INLINE=1` — always on (useful on a self-hosted Node host without a worker).
 * - `MARKETING_RENDER_INLINE=0` — always off (use a separate `npm run worker:marketing` even in dev).
 * - Unset in **development** (e.g. `next dev`) — **on by default** so marketing export works locally without env vars.
 * - Production / Vercel — off unless `MARKETING_RENDER_INLINE=1`.
 */
export function shouldRunInlineProcessor(): boolean {
  const explicit = process.env.MARKETING_RENDER_INLINE?.trim();
  if (explicit === '1' || explicit === 'true') return true;
  if (explicit === '0' || explicit === 'false') return false;
  if (process.env.VERCEL === '1') return false;
  return process.env.NODE_ENV === 'development';
}

export function describePipeline(mode: MarketingRenderMode): string[] {
  const steps: string[] = [];
  if (
    mode === 'branded_screen' ||
    mode === 'motion_walkthrough' ||
    mode === 'branded_plus_motion' ||
    mode === 'full_stack'
  ) {
    steps.push('Branded ffmpeg pass (letterbox + Brand Kit pad color → H.264 MP4)');
    steps.push(
      'Optional Brand Kit bookends: guide cover intro + video outro still (xfade) when those assets are set'
    );
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
    steps.push('Optional Brand Kit bookends on the final MP4 when guide cover / video outro are set');
  }
  return steps;
}
