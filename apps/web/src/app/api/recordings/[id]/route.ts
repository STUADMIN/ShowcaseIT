import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const recording = await prisma.recording.findUnique({ where: { id } });
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
  try {
    const body = await request.json();
    const recording = await prisma.recording.update({
      where: { id },
      data: { title: body.title, status: body.status },
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
  try {
    await prisma.recording.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 });
  }
}
