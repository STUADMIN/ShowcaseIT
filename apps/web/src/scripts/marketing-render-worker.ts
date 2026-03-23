/**
 * Polls Postgres for queued marketing render jobs and runs ffmpeg + Supabase upload.
 *
 * From repo: cd apps/web && npm run worker:marketing
 * Once:     npm run worker:marketing -- --once
 */
import { prisma } from '@/lib/db/prisma';
import { executeMarketingRenderJob } from '@/lib/marketing-render/run-job';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const once = process.argv.includes('--once');
  console.info('[marketing worker] started', once ? '(single pass)' : '(loop Ctrl+C to stop)');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await prisma.marketingRenderJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!job) {
      if (once) {
        console.info('[marketing worker] no queued jobs');
        break;
      }
      await sleep(4000);
      continue;
    }

    console.info('[marketing worker] processing', job.id);
    await executeMarketingRenderJob(job.id);
    const done = await prisma.marketingRenderJob.findUnique({
      where: { id: job.id },
      select: { status: true, outputUrl: true, error: true },
    });
    console.info('[marketing worker] result', done?.status, done?.outputUrl || done?.error || '');

    if (once) break;
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
