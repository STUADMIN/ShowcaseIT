import { prisma } from '@/lib/db/prisma';

/** Stale Prisma client (before `prisma generate`) omits this delegate → runtime ".create" / findUnique errors. */
export function marketingJobsDelegateMissing(): boolean {
  const p = prisma as unknown as {
    marketingRenderJob?: { create?: unknown; findUnique?: unknown; findMany?: unknown };
  };
  return (
    typeof p.marketingRenderJob?.create !== 'function' ||
    typeof p.marketingRenderJob?.findUnique !== 'function'
  );
}

export const PRISMA_MARKETING_JOBS_HINT =
  'Fix: in apps/web run `npx prisma migrate dev` (or `migrate deploy`), then `npx prisma generate`, then restart `next dev`.';
