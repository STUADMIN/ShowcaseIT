import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stepId } = await params;
  try {
    const step = await prisma.guideStep.findUnique({
      where: { id: stepId },
      select: { id: true, guideId: true },
    });
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const mime = file.type || 'image/png';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const storagePath = `${step.guideId}/${stepId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: true,
      });

    if (uploadError) {
      console.error('Step screenshot upload:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath);
    const screenshotUrl = urlData.publicUrl;

    const updated = await prisma.guideStep.update({
      where: { id: stepId },
      data: { screenshotUrl },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Step screenshot route error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
