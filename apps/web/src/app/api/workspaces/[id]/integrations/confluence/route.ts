import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { normalizeConfluenceConnectForm } from '@/lib/publish/confluence-input-normalize';
import { parseConfluenceIntegration, type ConfluenceIntegrationDto } from '@/lib/workspaces/confluence-integration';

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

/**
 * GET — load Confluence integration for a workspace (member only).
 * Stored in Postgres (e.g. Supabase) column `confluence_integration`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  const userId = request.nextUrl.searchParams.get('userId');

  try {
    const denied = await requireWorkspaceMember(workspaceId, userId);
    if (denied) return denied;

    const rows = await prisma.$queryRaw<{ confluence_integration: unknown }[]>`
      SELECT confluence_integration FROM workspaces WHERE id = ${workspaceId} LIMIT 1
    `;
    const raw = rows[0]?.confluence_integration;
    const dto = parseConfluenceIntegration(raw);
    return NextResponse.json(dto);
  } catch (e) {
    console.error('[confluence integration GET]', e);
    return NextResponse.json({ error: 'Failed to load Confluence settings' }, { status: 500 });
  }
}

type PatchBody = {
  userId?: string;
  connected?: boolean;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  spaceKey?: string;
  parentPageId?: string;
};

/**
 * PATCH — save Confluence integration (member only). Replaces stored JSON for this workspace.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;
  try {
    const body = (await request.json()) as PatchBody;
    const denied = await requireWorkspaceMember(workspaceId, body.userId ?? null);
    if (denied) return denied;

    const rows = await prisma.$queryRaw<{ confluence_integration: unknown }[]>`
      SELECT confluence_integration FROM workspaces WHERE id = ${workspaceId} LIMIT 1
    `;
    const current = parseConfluenceIntegration(rows[0]?.confluence_integration);

    const merged = {
      baseUrl: body.baseUrl !== undefined ? body.baseUrl : current.baseUrl,
      email: body.email !== undefined ? body.email : current.email,
      spaceKey: body.spaceKey !== undefined ? body.spaceKey : current.spaceKey,
      parentPageId: body.parentPageId !== undefined ? body.parentPageId : current.parentPageId,
      apiToken:
        body.apiToken !== undefined && body.apiToken.trim() !== ''
          ? body.apiToken.trim()
          : current.apiToken,
    };

    const norm = normalizeConfluenceConnectForm(merged);

    const next: ConfluenceIntegrationDto = {
      connected: body.connected ?? current.connected,
      baseUrl: norm.baseUrl,
      email: norm.email,
      spaceKey: norm.spaceKey,
      parentPageId: norm.parentPageId,
      apiToken: norm.apiToken,
    };

    await prisma.$executeRawUnsafe(
      `UPDATE workspaces SET confluence_integration = $1::jsonb WHERE id = $2`,
      JSON.stringify(next),
      workspaceId
    );

    return NextResponse.json(next);
  } catch (e) {
    console.error('[confluence integration PATCH]', e);
    const msg = e instanceof Error ? e.message : String(e);
    let error = 'Failed to save Confluence settings.';
    if (/confluence_integration|column .* does not exist|42703/i.test(msg)) {
      error =
        'Database is missing the Confluence column. On your machine run: npx prisma migrate deploy (then restart the app).';
    } else if (msg.length > 0 && msg.length < 220) {
      error = msg;
    }
    return NextResponse.json({ error }, { status: 500 });
  }
}
