import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const workspaces = await prisma.workspace.findMany({
      where: userId ? { members: { some: { userId } } } : undefined,
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
  try {
    const body = await request.json();
    const workspace = await prisma.workspace.create({
      data: {
        name: body.name || 'My Workspace',
        members: {
          create: {
            userId: body.userId,
            role: 'owner',
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
