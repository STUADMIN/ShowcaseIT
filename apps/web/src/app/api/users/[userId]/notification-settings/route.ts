import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function mapFromDb(u: {
  notifyGuidePublished: boolean;
  notifyTeamInvites: boolean;
  notifyWeeklyDigest: boolean;
}) {
  return {
    guidePublished: u.notifyGuidePublished,
    teamInvites: u.notifyTeamInvites,
    weeklyDigest: u.notifyWeeklyDigest,
  };
}

/** GET / PATCH notification toggles for Settings → Notifications */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyGuidePublished: true,
        notifyTeamInvites: true,
        notifyWeeklyDigest: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(mapFromDb(user));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const body = (await request.json()) as Partial<{
      guidePublished: boolean;
      teamInvites: boolean;
      weeklyDigest: boolean;
    }>;

    const data: Record<string, boolean> = {};
    if (typeof body.guidePublished === 'boolean') {
      data.notifyGuidePublished = body.guidePublished;
    }
    if (typeof body.teamInvites === 'boolean') {
      data.notifyTeamInvites = body.teamInvites;
    }
    if (typeof body.weeklyDigest === 'boolean') {
      data.notifyWeeklyDigest = body.weeklyDigest;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        notifyGuidePublished: true,
        notifyTeamInvites: true,
        notifyWeeklyDigest: true,
      },
    });

    return NextResponse.json(mapFromDb(user));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
