import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  try {
    const body = await request.json();
    const member = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: body.role },
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
  const { memberId } = await params;
  try {
    await prisma.workspaceMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
