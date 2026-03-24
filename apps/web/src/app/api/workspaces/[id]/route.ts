import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { normalizeOrgKey } from '@/lib/db/org-key';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';
import { findWorkspaceMembership, isWorkspaceAdmin } from '@/lib/workspaces/workspace-access';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const member = await findWorkspaceMembership(id, authId);
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { projects: true, members: true } },
      },
    });
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    return NextResponse.json(workspace);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await isWorkspaceAdmin(id, authId);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: { name?: string; plan?: string; orgKey?: string | null } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.plan !== undefined) data.plan = body.plan;

    let nextOrgKey: string | null | undefined;
    if (body.orgKey !== undefined) {
      nextOrgKey = normalizeOrgKey(body.orgKey);
      data.orgKey = nextOrgKey;
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data,
    });

    if (body.orgKey !== undefined) {
      await prisma.recording.updateMany({
        where: { project: { workspaceId: id } },
        data: { orgKey: nextOrgKey ?? null },
      });
      await prisma.guide.updateMany({
        where: { project: { workspaceId: id } },
        data: { orgKey: nextOrgKey ?? null },
      });
    }

    return NextResponse.json(workspace);
  } catch {
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}
