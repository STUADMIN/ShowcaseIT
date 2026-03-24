import { prisma } from '@/lib/db/prisma';

/** True if `userId` is a member of the workspace that owns `projectId`. */
export async function isUserMemberOfProjectWorkspace(
  userId: string,
  projectId: string
): Promise<boolean> {
  const row = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspace: { members: { some: { userId } } },
    },
    select: { id: true },
  });
  return Boolean(row);
}
