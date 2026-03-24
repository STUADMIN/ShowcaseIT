import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { normalizeOrgKey } from '@/lib/db/org-key';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, name } = body;

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing id or email' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { id },
      update: { name, email },
      create: { id, email, name },
    });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!membership) {
      /** First workspace for this account: they become the workspace admin (team owner). */
      const defaultOrgKey = normalizeOrgKey(process.env.DEFAULT_WORKSPACE_ORG_KEY);
      const ws = await prisma.workspace.create({
        data: {
          name: `${name || email.split('@')[0]}'s Workspace`,
          ...(defaultOrgKey ? { orgKey: defaultOrgKey } : {}),
          members: { create: { userId: user.id, role: 'admin' } },
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredWorkspaceId: ws.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
