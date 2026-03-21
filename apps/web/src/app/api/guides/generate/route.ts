import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';
import { extractFrames } from '@/lib/video/extract-frames';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordingId, style = 'clean', title, userId, projectId } = body;

    if (!recordingId) {
      return NextResponse.json({ error: 'recordingId is required' }, { status: 400 });
    }

    const recording = await prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    if (!recording.videoUrl) {
      return NextResponse.json({ error: 'Recording has no video URL' }, { status: 400 });
    }

    const supabase = createClient(
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
    // Without markers: dense timeline + grid-aware dedupe — allow more distinct steps before capping
    const maxFrames = clickTimestamps.length > 0 ? 50 : 56;

    let frames: Array<{ timestamp: number; imageBuffer: Buffer }>;
    try {
      frames = await extractFrames(videoBuffer, clickTimestamps, maxFrames);
    } catch (err) {
      console.error('Frame extraction failed:', err);
      frames = [];
    }

    function clickMetaForFrame(frameTs: number): { clickTarget?: Record<string, unknown> } {
      if (clickEvents.length === 0) return {};
      let best: StoredClick | null = null;
      let bestDelta = Infinity;
      for (const e of clickEvents) {
        const d = Math.abs(e.timestamp - frameTs);
        if (d < bestDelta && d <= 2500) {
          bestDelta = d;
          best = e;
        }
      }
      if (!best) return {};
      if (best.button === 'step-marker') return {};
      const x = best.x;
      const y = best.y;
      if (typeof x !== 'number' || typeof y !== 'number') return {};
      if (x === 0 && y === 0) return {};
      return {
        clickTarget: {
          x,
          y,
          button: best.button,
          elementText: best.elementText,
        },
      };
    }

    // Step 3: Create the guide
    const guide = await prisma.guide.create({
      data: {
        projectId: projectId || recording.projectId,
        userId: userId || recording.userId,
        recordingId: recording.id,
        title: title || `Guide from ${recording.title}`,
        description: `Auto-generated from recording "${recording.title}"`,
        style,
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

      const meta = clickMetaForFrame(frame.timestamp);
      const step = await prisma.guideStep.create({
        data: {
          guideId: guide.id,
          order: i + 1,
          title: `Step ${i + 1}`,
          description: '',
          screenshotUrl: screenshotUrl || null,
          timestamp: Math.round(frame.timestamp),
          clickTarget: meta.clickTarget ?? undefined,
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
          description:
            'No frames could be extracted from this video. Delete this guide, then go to Recordings → Generate Guide again. If it keeps failing, open /api/health/ffmpeg and confirm ok is true.',
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
