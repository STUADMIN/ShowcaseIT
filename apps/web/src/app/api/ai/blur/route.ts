import { NextRequest, NextResponse } from 'next/server';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const regions = formData.get('regions') as string;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const aiForm = new FormData();
    aiForm.append('image', image);
    aiForm.append('regions', regions || '[]');

    const res = await fetch(`${AI_SERVICE_URL}/api/blur/apply`, {
      method: 'POST',
      body: aiForm,
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'AI blur service failed' }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Blur processing failed' }, { status: 500 });
  }
}
