import { prisma } from '@/lib/db/prisma';

const accessibleWhere = (recordingId: string, userId: string) => ({
  id: recordingId,
  OR: [
    { userId },
    { project: { workspace: { members: { some: { userId } } } } },
  ],
});

/**
 * You can open a recording if you created it OR you belong to its project’s workspace.
 */
export async function findRecordingAccessibleToUser(recordingId: string, userId: string) {
  return prisma.recording.findFirst({
    where: accessibleWhere(recordingId, userId),
  });
}

export async function isRecordingAccessibleToUser(recordingId: string, userId: string): Promise<boolean> {
  const row = await prisma.recording.findFirst({
    where: accessibleWhere(recordingId, userId),
    select: { id: true },
  });
  return Boolean(row);
}
