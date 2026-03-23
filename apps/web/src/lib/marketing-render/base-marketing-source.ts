import { prisma } from '@/lib/db/prisma';

/**
 * Public URL of a finished marketing MP4 to use as input for `ai_enhanced`, or null if none.
 * Auto-pick prefers recent `branded_screen` | `motion_walkthrough` | `branded_plus_motion` (not `full_stack`, to avoid stacking grades).
 */
export async function findReadyBaseMarketingVideoUrl(params: {
  recordingId: string;
  userId: string;
  explicitJobId?: string | null;
}): Promise<string | null> {
  const id = params.explicitJobId?.trim();
  if (id) {
    const j = await prisma.marketingRenderJob.findFirst({
      where: {
        id,
        recordingId: params.recordingId,
        userId: params.userId,
        status: 'ready',
        outputUrl: { not: null },
      },
    });
    return j?.outputUrl?.trim() || null;
  }
  const j = await prisma.marketingRenderJob.findFirst({
    where: {
      recordingId: params.recordingId,
      userId: params.userId,
      status: 'ready',
      mode: { in: ['branded_screen', 'motion_walkthrough', 'branded_plus_motion'] },
      outputUrl: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });
  return j?.outputUrl?.trim() || null;
}
