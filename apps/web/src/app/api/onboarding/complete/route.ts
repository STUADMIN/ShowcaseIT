import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';

const MAX_LEN = 120;

/**
 * POST /api/onboarding/complete
 * Authenticated user only. Sets onboardingCompletedAt and optional profile/workspace names.
 */
export async function POST(request: NextRequest) {
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { displayName?: string; workspaceName?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const workspaceName = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : '';

  if (displayName.length > MAX_LEN) {
    return NextResponse.json({ error: 'Display name is too long' }, { status: 400 });
  }
  if (workspaceName.length > MAX_LEN) {
    return NextResponse.json({ error: 'Workspace name is too long' }, { status: 400 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: authId },
      select: { preferredWorkspaceId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authId },
        data: {
          ...(displayName ? { name: displayName } : {}),
          onboardingCompletedAt: new Date(),
        },
      });

      if (workspaceName && dbUser.preferredWorkspaceId) {
        const member = await tx.workspaceMember.findFirst({
          where: { workspaceId: dbUser.preferredWorkspaceId, userId: authId },
        });
        if (member) {
          await tx.workspace.update({
            where: { id: dbUser.preferredWorkspaceId },
            data: { name: workspaceName },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to complete onboarding';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
