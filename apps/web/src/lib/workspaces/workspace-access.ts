import { prisma } from '@/lib/db/prisma';
import { isWorkspaceAdminRole } from '@/lib/workspaces/workspace-role';

export async function findWorkspaceMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true, role: true },
  });
}

export async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const m = await findWorkspaceMembership(workspaceId, userId);
  return isWorkspaceAdminRole(m?.role);
}

/** Includes legacy `owner` until migrations have normalized roles. */
export async function countWorkspaceAdmins(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: {
      workspaceId,
      role: { in: ['admin', 'owner'] },
    },
  });
}
