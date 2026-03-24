import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orgKeyForProjectId } from '@/lib/db/org-key';
import { findRecordingAccessibleToUser } from '@/lib/recordings/recording-access';
import { createClient } from '@/lib/supabase/server';
import { isUserMemberOfProjectWorkspace } from '@/lib/projects/verify-project-access';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recording = await findRecordingAccessibleToUser(id, authUser.id);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    return NextResponse.json(recording);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authId = authUser.id;

  try {
    const body = (await request.json()) as {
      title?: string;
      status?: string;
      projectId?: string;
      userId?: string;
    };

    const existing = await findRecordingAccessibleToUser(id, authId);
    if (!existing) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const data: { title?: string; status?: string; projectId?: string; orgKey?: string | null } =
      {};
    if (body.title !== undefined) data.title = body.title;
    if (body.status !== undefined) data.status = body.status;

    const rawProjectId = body.projectId;
    const nextProjectId =
      rawProjectId === undefined || rawProjectId === null
        ? undefined
        : String(rawProjectId).trim();
    if (
      nextProjectId !== undefined &&
      nextProjectId.length > 0 &&
      nextProjectId !== existing.projectId
    ) {
      const [srcProject, tgtProject] = await Promise.all([
        prisma.project.findUnique({
          where: { id: existing.projectId },
          select: { workspaceId: true },
        }),
        prisma.project.findUnique({
          where: { id: nextProjectId },
          select: { workspaceId: true },
        }),
      ]);
      if (!srcProject || !tgtProject) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 400 });
      }
      if (srcProject.workspaceId !== tgtProject.workspaceId) {
        return NextResponse.json(
          { error: 'Recording and target project must be in the same workspace.' },
          { status: 400 }
        );
      }

      const member = await prisma.workspaceMember.findFirst({
        where: { userId: authId, workspaceId: srcProject.workspaceId },
        select: { id: true },
      });
      if (!member) {
        return NextResponse.json({ error: 'Not allowed to move this recording.' }, { status: 403 });
      }

      const targetReachable = await isUserMemberOfProjectWorkspace(authId, nextProjectId);
      if (!targetReachable) {
        return NextResponse.json(
          { error: 'That project was not found or you are not a member of its workspace.' },
          { status: 403 }
        );
      }

      data.projectId = nextProjectId;
      data.orgKey = await orgKeyForProjectId(nextProjectId);
    }

    const recording = await prisma.recording.update({
      where: { id },
      data,
    });
    return NextResponse.json(recording);
  } catch {
    return NextResponse.json({ error: 'Failed to update recording' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await findRecordingAccessibleToUser(id, authUser.id);
    if (!existing) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    await prisma.recording.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 });
  }
}
