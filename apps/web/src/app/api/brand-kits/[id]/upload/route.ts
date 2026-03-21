import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createClient } from '@supabase/supabase-js';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: brandKitId } = await params;
  try {
    const kit = await prisma.brandKit.findUnique({
      where: { id: brandKitId },
      select: { id: true },
    });
    if (!kit) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kind = (formData.get('kind') as string) || 'logo';

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be 2MB or smaller' }, { status: 400 });
    }

    const mime = file.type || 'image/png';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (kind !== 'logo' && kind !== 'guideCover') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    const ext =
      mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpg'
        : mime.includes('webp')
          ? 'webp'
          : mime.includes('svg')
            ? 'svg'
            : 'png';

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath =
      kind === 'logo'
        ? `brand-kits/${brandKitId}/logo.${ext}`
        : `brand-kits/${brandKitId}/guide-cover.${ext}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const { error: uploadError } = await supabase.storage.from('screenshots').upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (uploadError) {
      console.error('Brand kit upload:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const updated = await prisma.brandKit.update({
      where: { id: brandKitId },
      data: kind === 'logo' ? { logoUrl: publicUrl } : { guideCoverImageUrl: publicUrl },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Brand kit upload route error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
