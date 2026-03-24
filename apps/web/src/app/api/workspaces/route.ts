import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { normalizeOrgKey } from '@/lib/db/org-key';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';

export async function GET(request: NextRequest) {
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const qUserId = request.nextUrl.searchParams.get('userId')?.trim();
  if (qUserId && qUserId !== authId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: authId } } },
      include: {
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(workspaces);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body.userId !== authId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgKey = normalizeOrgKey(body.orgKey);
    const workspace = await prisma.workspace.create({
      data: {
        name: body.name || 'My Workspace',
        ...(orgKey ? { orgKey } : {}),
        members: {
          create: {
            userId: authId,
            role: 'admin',
          },
        },
      },
      include: { members: true },
    });
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
