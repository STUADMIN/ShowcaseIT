import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
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
  try {
    const body = await request.json();
    const workspace = await prisma.workspace.update({
      where: { id },
      data: { name: body.name, plan: body.plan },
    });
    return NextResponse.json(workspace);
  } catch {
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}
