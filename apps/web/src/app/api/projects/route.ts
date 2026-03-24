import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const userId = searchParams.get('userId')?.trim();

  try {
    const projects = await prisma.project.findMany({
      where: workspaceId
        ? { workspaceId }
        : userId
          ? { workspace: { members: { some: { userId } } } }
          : undefined,
      include: {
        _count: { select: { guides: true, recordings: true } },
        brandKit: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const project = await prisma.project.create({
      data: {
        workspaceId: body.workspaceId,
        name: body.name || 'Untitled Project',
        description: body.description,
        brandKitId: body.brandKitId,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
