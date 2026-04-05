import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';
import { prisma } from '@/lib/db/prisma';
import { orgKeyForProjectId } from '@/lib/db/org-key';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { EnsureProjectError, ensureProjectForBrand } from '@/lib/projects/ensure-project-for-brand';
import { isUserMemberOfProjectWorkspace } from '@/lib/projects/verify-project-access';

export async function POST(request: NextRequest) {
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const metadataStr = formData.get('metadata') as string | null;

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    // Resolve projectId and userId -- prefer workspace + brand (member-checked), then legacy fallbacks
    let projectId = metadata.projectId as string | undefined;
    let userId = metadata.userId as string | undefined;
    const metaWorkspaceId = metadata.workspaceId as string | undefined;
    const metaBrandKitId = metadata.brandKitId as string | undefined;

    if ((!projectId || !userId) && metaWorkspaceId && metadata.userId) {
      try {
        const { projectId: ensured } = await ensureProjectForBrand(
          metaWorkspaceId,
          metadata.userId as string,
          typeof metaBrandKitId === 'string' && metaBrandKitId.trim()
            ? { brandKitId: metaBrandKitId.trim() }
            : undefined
        );
        projectId = projectId || ensured;
        userId = userId || (metadata.userId as string);
      } catch (e) {
        if (e instanceof EnsureProjectError) {
          return NextResponse.json(
            { error: e.message },
            { status: e.code === 'FORBIDDEN' ? 403 : 400 }
          );
        }
        throw e;
      }
    }

    if (!projectId || !userId) {
      return NextResponse.json(
        {
          error:
            'workspaceId (or projectId) and userId are required. Open the app signed in and start recording from the web UI.',
        },
        { status: 400 }
      );
    }

    if (userId !== authId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowedProject = await isUserMemberOfProjectWorkspace(authId, projectId);
    if (!allowedProject) {
      return NextResponse.json(
        { error: 'You are not a member of the workspace for this project.' },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const orgKey = await orgKeyForProjectId(projectId);
    const recording = await prisma.recording.create({
      data: {
        projectId,
        userId,
        title: metadata.title || metadata.sourceName || 'Untitled Recording',
        duration: metadata.duration || 0,
        width: metadata.width || 1920,
        height: metadata.height || 1080,
        mouseEvents: metadata.mouseEvents || [],
        clickEvents: metadata.clickEvents || [],
        hasVoiceover: Boolean(metadata.hasVoiceover),
        status: 'uploading',
        orgKey,
      },
    });

    const storagePath = `${projectId}/${recording.id}/video.webm`;
    const buffer = Buffer.from(await videoFile.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: 'video/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError.message, storagePath);
      await prisma.recording.update({
        where: { id: recording.id },
        data: { status: 'failed' },
      });
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(storagePath);

    const updated = await prisma.recording.update({
      where: { id: recording.id },
      data: {
        videoUrl: urlData.publicUrl,
        status: 'ready',
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error('Recording upload error:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    const cause = err.cause instanceof Error ? err.cause.message : err.cause;
    if (cause) console.error('Recording upload cause:', cause);
    const message = err.message || 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
