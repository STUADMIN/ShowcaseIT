import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { mergeGuideCoverImageUrl } from '@/lib/db/merge-brand-kit-cover';
import { generateHtmlExport } from '@/lib/export/html-generator';
import { buildExportGuide, mapPrismaBrandKit } from '@/lib/export/map-guide-for-html';
import { ConfluenceClient, createConfluenceAuthToken } from '@/lib/social/confluence-client';
import { parseConfluenceIntegration } from '@/lib/workspaces/confluence-integration';

function buildConfluencePageUrl(baseUrl: string, webUiPath: string): string {
  const root = baseUrl.replace(/\/$/, '');
  if (webUiPath.startsWith('http')) return webUiPath;
  const path = webUiPath.startsWith('/') ? webUiPath : `/${webUiPath}`;
  return `${root}${path}`;
}

async function requireWorkspaceMember(workspaceId: string, userId: string | null) {
  if (!userId?.trim()) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

function parseLabels(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type PublishBody = {
  userId?: string;
  guideId?: string;
  pageTitle?: string;
  pageDescription?: string | null;
  labels?: string;
  updateIfTitleMatches?: boolean;
  applyBrandStyling?: boolean;
  includeScreenshots?: boolean;
  scope?: 'all' | 'exportable';
};

/**
 * POST — publish a guide to Confluence using this workspace’s stored integration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  try {
    const body = (await request.json()) as PublishBody;
    const denied = await requireWorkspaceMember(workspaceId, body.userId ?? null);
    if (denied) return denied;

    const guideId = body.guideId?.trim();
    if (!guideId) {
      return NextResponse.json({ error: 'guideId is required' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<{ confluence_integration: unknown }[]>`
      SELECT confluence_integration FROM workspaces WHERE id = ${workspaceId} LIMIT 1
    `;
    const integration = parseConfluenceIntegration(rows[0]?.confluence_integration);
    if (!integration.apiToken?.trim() || !integration.baseUrl?.trim() || !integration.email?.trim()) {
      return NextResponse.json(
        { error: 'Confluence is not configured for this workspace. Connect Confluence in Publish first.' },
        { status: 400 }
      );
    }
    if (!integration.spaceKey?.trim()) {
      return NextResponse.json({ error: 'Confluence space key is missing.' }, { status: 400 });
    }

    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        brandKit: true,
        project: { include: { brandKit: true } },
      },
    });

    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    /**
     * Access model matches the Publish UI: the guide list is not scoped per team, so any guide may be
     * published using this workspace’s Confluence as long as the caller is a member of this workspace
     * (`requireWorkspaceMember` above). Use a dedicated database per customer in production if guides
     * from other orgs must not appear in the picker.
     */

    const rawBrandKit = guide.brandKit ?? guide.project?.brandKit ?? null;
    if (rawBrandKit) {
      await mergeGuideCoverImageUrl([rawBrandKit]);
    }
    const mappedBrandKit = rawBrandKit ? mapPrismaBrandKit(rawBrandKit) : null;

    const scope = body.scope === 'all' ? 'all' : 'exportable';
    const stepsForExport =
      scope === 'all' ? guide.steps : guide.steps.filter((s) => s.includeInExport !== false);

    if (stepsForExport.length === 0) {
      return NextResponse.json(
        { error: 'No steps to publish. Add steps or change export scope to “all”.' },
        { status: 400 }
      );
    }

    const pageTitle = body.pageTitle?.trim() || guide.title;
    const pageDescription =
      body.pageDescription !== undefined ? body.pageDescription : (guide.description ?? null);

    const exportGuide = buildExportGuide(
      {
        id: guide.id,
        title: pageTitle,
        description: pageDescription,
      },
      stepsForExport
    );

    const applyBrand = body.applyBrandStyling !== false;
    const html = generateHtmlExport({
      guide: exportGuide,
      brandKit: applyBrand ? mappedBrandKit ?? undefined : undefined,
      embedMode: 'standalone',
      includeAnimations: false,
      includeDocumentShell: true,
      linkPreviewPlatform: null,
    });

    const authToken = createConfluenceAuthToken(integration.email.trim(), integration.apiToken.trim());
    const client = new ConfluenceClient({
      baseUrl: integration.baseUrl.trim(),
      authToken,
    });

    const labels = parseLabels(body.labels);
    const parentPageId = integration.parentPageId?.trim() || undefined;
    /** Title and key differ in Confluence; resolve so "XertiloxHR" (name) maps to the real URL key. */
    const spaceKey = await client.resolveSpaceKey(integration.spaceKey.trim());

    let page: Awaited<ReturnType<ConfluenceClient['createPage']>>;
    let updated = false;

    if (body.updateIfTitleMatches) {
      const existing = await client.findPageByTitle(spaceKey, pageTitle);
      if (existing) {
        page = await client.updatePage({
          pageId: existing.id,
          title: pageTitle,
          htmlContent: html,
          version: existing.version,
          labels: labels.length ? labels : undefined,
        });
        updated = true;
      } else {
        page = await client.createPage({
          spaceKey,
          title: pageTitle,
          htmlContent: html,
          parentPageId,
          labels: labels.length ? labels : undefined,
        });
      }
    } else {
      page = await client.createPage({
        spaceKey,
        title: pageTitle,
        htmlContent: html,
        parentPageId,
        labels: labels.length ? labels : undefined,
      });
    }

    const webUi = page._links?.webui;
    const pageUrl = webUi
      ? buildConfluencePageUrl(integration.baseUrl.trim(), webUi)
      : null;

    try {
      await prisma.publishLog.create({
        data: {
          guideId,
          platform: 'confluence',
          externalId: page.id,
          externalUrl: pageUrl,
          status: 'success',
          metadata: { workspaceId, updated, spaceKey },
        },
      });
    } catch (logErr) {
      console.warn('[confluence publish] publish_log insert failed:', logErr);
    }

    return NextResponse.json({
      ok: true,
      pageId: page.id,
      url: pageUrl,
      updated,
      title: page.title,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Publish failed';
    console.error('[confluence publish]', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
