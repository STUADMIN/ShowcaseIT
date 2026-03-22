import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/db/prisma';

const MAX_BYTES = 2 * 1024 * 1024;

/** POST multipart field "file" — stores in screenshots bucket, updates users.avatar_url */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be 2MB or smaller' }, { status: 400 });
    }

    const mime = file.type || 'image/png';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    const ext =
      mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpg'
        : mime.includes('webp')
          ? 'webp'
          : 'png';

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `avatars/${userId}.${ext}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const { error: uploadError } = await supabase.storage.from('screenshots').upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (uploadError) {
      console.error('Avatar upload:', uploadError.message);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('Avatar route error:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
