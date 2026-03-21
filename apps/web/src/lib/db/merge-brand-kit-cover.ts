import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/** Fills `guideCoverImageUrl` from DB so responses work even when Prisma Client is stale vs schema. */
export async function mergeGuideCoverImageUrl<
  T extends { id: string; guideCoverImageUrl?: string | null },
>(kits: T[]): Promise<void> {
  if (kits.length === 0) return;
  const uniqueIds = [...new Set(kits.map((k) => k.id))];
  const rows = await prisma.$queryRaw<Array<{ id: string; guide_cover_image_url: string | null }>>(
    Prisma.sql`SELECT id, guide_cover_image_url FROM brand_kits WHERE id IN (${Prisma.join(
      uniqueIds.map((id) => Prisma.sql`${id}`)
    )})`
  );
  const map = new Map(rows.map((r) => [r.id, r.guide_cover_image_url]));
  for (const k of kits) {
    k.guideCoverImageUrl = map.get(k.id) ?? null;
  }
}
