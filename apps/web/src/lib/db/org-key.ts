import { prisma } from '@/lib/db/prisma';

/** URL-safe org slug: lowercase letters, digits, hyphens; max 63 chars. */
const ORG_KEY_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Normalize user input (e.g. "Xertilox" → "xertilox"). Returns null if empty or invalid.
 */
export function normalizeOrgKey(input: string | null | undefined): string | null {
  if (input == null || typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (!ORG_KEY_RE.test(s)) return null;
  return s;
}

export async function orgKeyForProjectId(projectId: string): Promise<string | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspace: { select: { orgKey: true } } },
  });
  return p?.workspace?.orgKey ?? null;
}
