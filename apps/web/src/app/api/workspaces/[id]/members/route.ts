import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  try {
    const body = await request.json();

    let user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: body.email, name: body.name || body.email.split('@')[0] },
      });
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: body.role || 'editor',
      },
      include: { user: true },
    });

    return NextResponse.json(member, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
