import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  try {
    const brandKits = await prisma.brandKit.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(brandKits);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch brand kits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const brandKit = await prisma.brandKit.create({
      data: {
        workspaceId: body.workspaceId,
        name: body.name || 'My Brand',
        colorPrimary: body.colorPrimary,
        colorSecondary: body.colorSecondary,
        colorAccent: body.colorAccent,
        colorBackground: body.colorBackground,
        colorForeground: body.colorForeground,
        fontHeading: body.fontHeading,
        fontBody: body.fontBody,
        logoUrl: body.logoUrl,
      },
    });
    return NextResponse.json(brandKit, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create brand kit' }, { status: 500 });
  }
}
