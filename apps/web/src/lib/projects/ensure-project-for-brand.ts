import { prisma } from '@/lib/db/prisma';

export class EnsureProjectError extends Error {
  constructor(
    message: string,
    readonly code: 'FORBIDDEN' | 'BRAND_KIT_NOT_FOUND'
  ) {
    super(message);
    this.name = 'EnsureProjectError';
  }
}

/**
 * Returns a project for the workspace, optionally scoped to a brand kit.
 * When `brandKitId` is omitted, uses the oldest project in the workspace (creates "Main" if none).
 * When set to a kit id, finds or creates a project with that `brandKitId`.
 * When explicitly `null`, finds or creates a project with no brand kit (unassigned).
 */
export async function ensureProjectForBrand(
  workspaceId: string,
  userId: string,
  options?: { brandKitId?: string | null }
): Promise<{ projectId: string }> {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  });
  if (!member) {
    throw new EnsureProjectError('Not a member of this workspace.', 'FORBIDDEN');
  }

  const brandKitId = options?.brandKitId;

  if (brandKitId === undefined) {
    let p = await prisma.project.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    if (!p) {
      p = await prisma.project.create({
        data: { workspaceId, name: 'Main' },
      });
    }
    return { projectId: p.id };
  }

  if (brandKitId !== null) {
    const kit = await prisma.brandKit.findFirst({
      where: { id: brandKitId, workspaceId },
      select: { id: true, name: true },
    });
    if (!kit) {
      throw new EnsureProjectError('Brand kit not found in this workspace.', 'BRAND_KIT_NOT_FOUND');
    }
  }

  let p = await prisma.project.findFirst({
    where: {
      workspaceId,
      brandKitId: brandKitId === null ? null : brandKitId,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!p) {
    let name = 'General';
    if (brandKitId) {
      const kit = await prisma.brandKit.findUnique({
        where: { id: brandKitId },
        select: { name: true },
      });
      name = kit?.name?.trim() || 'Brand';
    }
    p = await prisma.project.create({
      data: { workspaceId, name, brandKitId: brandKitId ?? null },
    });
  }
  return { projectId: p.id };
}
