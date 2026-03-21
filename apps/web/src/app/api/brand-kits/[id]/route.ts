import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const brandKit = await prisma.brandKit.findUnique({ where: { id } });
    if (!brandKit) {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 });
    }
    return NextResponse.json(brandKit);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch brand kit' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const brandKit = await prisma.brandKit.update({
      where: { id },
      data: {
        name: body.name,
        colorPrimary: body.colorPrimary,
        colorSecondary: body.colorSecondary,
        colorAccent: body.colorAccent,
        colorBackground: body.colorBackground,
        colorForeground: body.colorForeground,
        fontHeading: body.fontHeading,
        fontBody: body.fontBody,
        logoUrl: body.logoUrl,
        guideCoverImageUrl: body.guideCoverImageUrl,
      },
    });
    return NextResponse.json(brandKit);
  } catch {
    return NextResponse.json({ error: 'Failed to update brand kit' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.brandKit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete brand kit' }, { status: 500 });
  }
}
