import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { getServerAuthUserId } from '@/lib/auth/supabase-server-user';
import { prisma } from '@/lib/db/prisma';
import { orgKeyForProjectId } from '@/lib/db/org-key';
import { isRecordingAccessibleToUser } from '@/lib/recordings/recording-access';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { FRAME_EXTRACTION_PLACEHOLDER_DESCRIPTION } from '@/lib/frame-extraction-placeholder';
import {
  type StepFrameMeta,
  suggestedStepTitleAndDescription,
} from '@/lib/guide/step-suggested-copy';

/** Long recordings need more time for ffmpeg + many Supabase uploads */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authId = await getServerAuthUserId();
  if (!authId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { recordingId, style = 'clean', title, projectId } = body;

    if (!recordingId) {
      return NextResponse.json({ error: 'recordingId is required' }, { status: 400 });
    }

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const canAccess = await isRecordingAccessibleToUser(recordingId, authId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!recording.videoUrl) {
      return NextResponse.json({ error: 'Recording has no video URL' }, { status: 400 });
    }

    if (recording.hasVoiceover) {
      return NextResponse.json(
        {
          error:
            'Guide generation is not available for voiceover (library) recordings. Open the recording on the Recordings page to copy the video link or embed HTML.',
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    // Step 1: Download video from storage
    const videoRes = await fetch(recording.videoUrl);
    if (!videoRes.ok) {
      return NextResponse.json({ error: 'Failed to download video from storage' }, { status: 500 });
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const head = videoBuffer.subarray(0, Math.min(64, videoBuffer.length)).toString('utf8');
    if (head.trimStart().startsWith('<') || head.includes('<!DOCTYPE')) {
      return NextResponse.json(
        {
          error:
            'Video URL did not return a video file (got HTML). Check that the recordings bucket is public or use a signed URL.',
        },
        { status: 502 }
      );
    }
    if (videoBuffer.length < 500) {
      return NextResponse.json({ error: 'Downloaded video file is too small or empty' }, { status: 502 });
    }

    // Step 2: Extract frames using ffmpeg (one frame per click / step marker when present)
    type StoredClick = {
      timestamp: number;
      x?: number;
      y?: number;
      button?: string;
      elementText?: string;
    };
    const clickEvents = (recording.clickEvents as StoredClick[]) || [];
    const clickTimestamps = clickEvents.map((e) => e.timestamp);
    const maxClickTs = clickTimestamps.length > 0 ? Math.max(...clickTimestamps) : 0;
    /**
     * Wall-clock length from the recorder — already **milliseconds** (`Date.now() - start` on the client).
     * Do not multiply by 1000 (that blew the hint to ~hours, broke sparse step sampling, and left only 2–3 marker frames).
     */
    let recordingDurationMs = Math.max(0, Number(recording.duration) || 0);
    // Legacy rows: duration stored as seconds (e.g. 65) while marker timestamps are ms (58000).
    if (recordingDurationMs > 0 && recordingDurationMs < 100_000 && maxClickTs > recordingDurationMs * 20) {
      recordingDurationMs *= 1000;
    }
    // Corrupt / inflated values (e.g. old bug): clamp so timeline sampling stays near the real clip + markers.
    if (maxClickTs > 0 && recordingDurationMs > maxClickTs + 180_000) {
      recordingDurationMs = maxClickTs + 90_000;
    }
    const envCap = parseInt(process.env.GUIDE_GENERATE_MAX_FRAMES || '', 10);
    const hasMarkers = clickTimestamps.length > 0;
    /** Room for every mark + auto end-cap; user trims in the guide editor */
    const defaultMax = hasMarkers
      ? Math.min(800, Math.max(clickTimestamps.length + 30, 240))
      : 180;
    const maxFrames =
      Number.isFinite(envCap) && envCap > 0 ? Math.min(800, envCap) : defaultMax;

    let frames: Array<{ timestamp: number; imageBuffer: Buffer }>;
    try {
      const { extractFrames } = await import('@/lib/video/extract-frames');
      frames = await extractFrames(videoBuffer, clickTimestamps, maxFrames, recordingDurationMs, {
        keepEveryMarker: hasMarkers,
      });
    } catch (err) {
      console.error('Frame extraction failed:', err);
      frames = [];
    }

    function frameMetaForTimestamp(frameTs: number): StepFrameMeta {
      if (clickEvents.length === 0) return { kind: 'none' };
      let best: StoredClick | null = null;
      let bestDelta = Infinity;
      for (const e of clickEvents) {
        const d = Math.abs(e.timestamp - frameTs);
        if (d < bestDelta && d <= 2500) {
          bestDelta = d;
          best = e;
        }
      }
      if (!best) return { kind: 'none' };
      if (best.button === 'step-marker') return { kind: 'marker' };
      const x = best.x;
      const y = best.y;
      if (typeof x !== 'number' || typeof y !== 'number') return { kind: 'none' };
      if (x === 0 && y === 0) return { kind: 'marker' };
      return {
        kind: 'click',
        clickTarget: {
          x,
          y,
          button: best.button,
          elementText: best.elementText,
        },
      };
    }

    function clickTargetForDb(meta: StepFrameMeta): Record<string, unknown> | undefined {
      if (meta.kind !== 'click') return undefined;
      return meta.clickTarget as Record<string, unknown>;
    }

    // Step 3: Create the guide
    const resolvedProjectId = projectId || recording.projectId;
    const orgKey = await orgKeyForProjectId(resolvedProjectId);
    const guide = await prisma.guide.create({
      data: {
        projectId: resolvedProjectId,
        userId: authId,
        recordingId: recording.id,
        title: title || `Guide from ${recording.title}`,
        description: `Auto-generated from recording "${recording.title}"`,
        style,
        orgKey,
      },
    });

    // Step 4: Upload each frame and create guide steps
    const steps = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      const screenshotPath = `${guide.id}/step-${i + 1}.png`;
      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(screenshotPath, frame.imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      let screenshotUrl = '';
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('screenshots')
          .getPublicUrl(screenshotPath);
        screenshotUrl = urlData.publicUrl;
      }

      const meta = frameMetaForTimestamp(frame.timestamp);
      const copy = suggestedStepTitleAndDescription({
        stepIndex: i,
        meta,
        recordingTitle: recording.title,
      });
      const ct = clickTargetForDb(meta);
      const step = await prisma.guideStep.create({
        data: {
          guideId: guide.id,
          order: i + 1,
          title: copy.title,
          description: copy.description,
          screenshotUrl: screenshotUrl || null,
          timestamp: Math.round(frame.timestamp),
          clickTarget: ct != null ? (ct as Prisma.InputJsonValue) : undefined,
          includeInExport: true,
        },
      });
      steps.push(step);
    }

    // If no frames were extracted, create a single placeholder step
    if (steps.length === 0) {
      const placeholderStep = await prisma.guideStep.create({
        data: {
          guideId: guide.id,
          order: 1,
          title: 'Step 1',
          description: FRAME_EXTRACTION_PLACEHOLDER_DESCRIPTION,
        },
      });
      steps.push(placeholderStep);
    }

    const fullGuide = await prisma.guide.findUnique({
      where: { id: guide.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json(fullGuide, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate guide';
    console.error('Guide generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
