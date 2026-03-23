import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { UserUiPreferences } from '@/lib/user-preferences/types';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function mergeUiPreferences(
  current: UserUiPreferences,
  patch: UserUiPreferences | undefined
): UserUiPreferences {
  if (!patch) return current;
  const next: UserUiPreferences = { ...current };
  if (patch.liquidGlass) {
    const prev = asRecord(current.liquidGlass);
    next.liquidGlass = { ...prev, ...asRecord(patch.liquidGlass) } as UserUiPreferences['liquidGlass'];
  }
  return next;
}

/** GET /api/users/[userId]/preferences — persisted UI + workspace selection */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferredWorkspaceId: true,
        recordingMicEnabled: true,
        uiPreferences: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const uiPreferences = asRecord(user.uiPreferences) as UserUiPreferences;
    return NextResponse.json({
      preferredWorkspaceId: user.preferredWorkspaceId,
      recordingMicEnabled: user.recordingMicEnabled,
      uiPreferences,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  preferredWorkspaceId?: string | null;
  recordingMicEnabled?: boolean;
  uiPreferences?: UserUiPreferences;
};

/** PATCH /api/users/[userId]/preferences */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const body = (await request.json()) as PatchBody;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, uiPreferences: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (body.preferredWorkspaceId !== undefined && body.preferredWorkspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId: body.preferredWorkspaceId },
        select: { id: true },
      });
      if (!member) {
        return NextResponse.json(
          { error: 'You are not a member of that workspace.' },
          { status: 403 }
        );
      }
    }

    const currentUi = asRecord(existing.uiPreferences) as UserUiPreferences;
    const mergedUi =
      body.uiPreferences !== undefined ? mergeUiPreferences(currentUi, body.uiPreferences) : undefined;

    const data: Prisma.UserUpdateInput = {};
    if (body.preferredWorkspaceId !== undefined) {
      data.preferredWorkspaceId = body.preferredWorkspaceId || null;
    }
    if (typeof body.recordingMicEnabled === 'boolean') {
      data.recordingMicEnabled = body.recordingMicEnabled;
    }
    if (mergedUi !== undefined) {
      data.uiPreferences = mergedUi as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        preferredWorkspaceId: true,
        recordingMicEnabled: true,
        uiPreferences: true,
      },
    });

    return NextResponse.json({
      preferredWorkspaceId: user.preferredWorkspaceId,
      recordingMicEnabled: user.recordingMicEnabled,
      uiPreferences: asRecord(user.uiPreferences) as UserUiPreferences,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
