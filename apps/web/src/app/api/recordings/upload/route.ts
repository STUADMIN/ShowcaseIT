import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const metadataStr = formData.get('metadata') as string | null;

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    // Resolve projectId and userId -- fall back to first available project/member
    let projectId = metadata.projectId;
    let userId = metadata.userId;

    if (!projectId || !userId) {
      const defaultProject = await prisma.project.findFirst({
        orderBy: { createdAt: 'asc' },
        include: { workspace: { include: { members: true } } },
      });

      if (!defaultProject) {
        return NextResponse.json(
          { error: 'No project found. Create a project in the web app first.' },
          { status: 400 }
        );
      }

      projectId = projectId || defaultProject.id;
      userId = userId || defaultProject.workspace.members[0]?.userId;

      if (!userId) {
        const firstUser = await prisma.user.findFirst();
        userId = firstUser?.id;
      }

      if (!userId) {
        return NextResponse.json({ error: 'No user found in the system.' }, { status: 400 });
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

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
