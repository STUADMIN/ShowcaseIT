import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db/prisma';

/** GET /api/users/[userId] — profile for Settings / sidebar refresh */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/users/[userId] — display name */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const body = (await request.json()) as { name?: string };
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    const trimmed = body.name.trim();
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: trimmed || null },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    return NextResponse.json(user);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const DELETE_CONFIRM = 'DELETE MY ACCOUNT';

/**
 * DELETE /api/users/[userId]
 * Body: { "confirm": "DELETE MY ACCOUNT" }
 * Removes app data; optionally removes Supabase auth user when service role is configured.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    let body: { confirm?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
    }
    if (body.confirm !== DELETE_CONFIRM) {
      return NextResponse.json(
        { error: `Send { "confirm": "${DELETE_CONFIRM}" }` },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const guides = await prisma.guide.findMany({
      where: { userId },
      select: { id: true },
    });
    const guideIds = guides.map((g) => g.id);

    await prisma.$transaction(async (tx) => {
      if (guideIds.length > 0) {
        await tx.publishLog.deleteMany({ where: { guideId: { in: guideIds } } });
      }
      await tx.guide.deleteMany({ where: { userId } });
      await tx.recording.deleteMany({ where: { userId } });
      await tx.workspaceMember.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && userId !== 'dev-user-1') {
      try {
        const admin = createClient(url, key);
        await admin.auth.admin.deleteUser(userId);
      } catch (authErr) {
        console.warn('[DELETE user] Supabase admin.deleteUser failed (user may be DB-only):', authErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
