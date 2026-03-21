import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateHtmlExport } from '@/lib/export/html-template';
import { buildGuideDocxBuffer } from '@/lib/export/build-guide-docx';
import { buildGuidePdfBuffer } from '@/lib/export/build-guide-pdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';
    const mode = searchParams.get('mode') || 'standalone';
    /** all = every step; exportable = only steps with includeInExport true (default) */
    const scope = searchParams.get('scope') || 'exportable';

    const guide = await prisma.guide.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        brandKit: true,
      },
    });

    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    const stepsForExport =
      scope === 'all'
        ? guide.steps
        : guide.steps.filter((s) => s.includeInExport !== false);

    const exportSteps = stepsForExport.map((s) => ({
      order: s.order,
      title: s.title,
      description: s.description || '',
      screenshotUrl: s.screenshotUrl,
    }));

    if (format === 'html') {
      const html = generateHtmlExport(
        {
          title: guide.title,
          description: guide.description,
          steps: exportSteps.map((s) => ({
            order: s.order,
            title: s.title,
            description: s.description,
            screenshotUrl: s.screenshotUrl,
            tipType: null,
          })),
          brandKit: guide.brandKit
            ? {
                colorPrimary: guide.brandKit.colorPrimary || undefined,
                colorSecondary: guide.brandKit.colorSecondary || undefined,
                colorAccent: guide.brandKit.colorAccent || undefined,
                fontFamily:
                  [guide.brandKit.fontHeading, guide.brandKit.fontBody].filter(Boolean).join(', ') ||
                  undefined,
                logoUrl: guide.brandKit.logoUrl,
              }
            : null,
        },
        {
          standalone: mode === 'standalone',
          includeWrapper: mode !== 'snippet',
        }
      );

      if (mode === 'download') {
        const filename = `${guide.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.html`;
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      if (mode === 'snippet') {
        return NextResponse.json({ html, title: guide.title });
      }

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const safeBase = guide.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'guide';

    if (format === 'docx') {
      const buffer = await buildGuideDocxBuffer({
        title: guide.title,
        description: guide.description,
        steps: exportSteps,
      });
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${safeBase}.docx"`,
        },
      });
    }

    if (format === 'pdf') {
      const bytes = await buildGuidePdfBuffer({
        title: guide.title,
        description: guide.description,
        steps: exportSteps,
      });
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeBase}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: `Format "${format}" not supported` }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
