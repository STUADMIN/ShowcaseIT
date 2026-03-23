import { PrismaClient } from '@/generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** True if this client was generated before `MarketingRenderJob` existed (stale dev singleton). */
function marketingDelegateMissing(client: PrismaClient | undefined): boolean {
  if (!client) return false;
  const m = client as unknown as { marketingRenderJob?: { create?: unknown } };
  return typeof m.marketingRenderJob?.create !== 'function';
}

/**
 * Next.js dev keeps `globalThis.prisma` across HMR. After `prisma generate`, the old instance may
 * lack new models → drop it so the next import uses the updated generated client.
 */
if (process.env.NODE_ENV !== 'production' && marketingDelegateMissing(globalForPrisma.prisma)) {
  const stale = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  if (stale) void stale.$disconnect().catch(() => {});
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
