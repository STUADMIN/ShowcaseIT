import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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
      await prisma.workspace.create({
        data: {
          name: `${name || email.split('@')[0]}'s Workspace`,
          members: { create: { userId: user.id, role: 'owner' } },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
