import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';
import { countWorkspaceAdmins, isWorkspaceAdmin } from '@/lib/workspaces/workspace-access';
import {
  isWorkspaceAdminRole,
  normalizeWorkspaceMemberRole,
} from '@/lib/workspaces/workspace-role';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: workspaceId, memberId } = await params;
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWorkspaceAdmin(workspaceId, authId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const newRole = normalizeWorkspaceMemberRole(body.role);

    const target = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const wasAdmin = isWorkspaceAdminRole(target.role);
    if (wasAdmin && newRole === 'member') {
      const admins = await countWorkspaceAdmins(workspaceId);
      if (admins <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the only workspace admin.' },
          { status: 400 }
        );
      }
    }

    const member = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: { user: true },
    });
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: workspaceId, memberId } = await params;
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isWorkspaceAdmin(workspaceId, authId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const target = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (isWorkspaceAdminRole(target.role)) {
      const admins = await countWorkspaceAdmins(workspaceId);
      if (admins <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the only workspace admin.' },
          { status: 400 }
        );
      }
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
