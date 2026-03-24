import { NextRequest, NextResponse } from 'next/server';
import { EnsureProjectError, ensureProjectForBrand } from '@/lib/projects/ensure-project-for-brand';

/** GET — default project for recordings / guides in a workspace, optionally tied to a brand kit */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await context.params;
    const userId = request.nextUrl.searchParams.get('userId');
    const brandKitIdParam = request.nextUrl.searchParams.get('brandKitId');

    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    let brandOption: { brandKitId?: string | null } | undefined;
    if (brandKitIdParam === '__unassigned__') {
      brandOption = { brandKitId: null };
    } else if (brandKitIdParam?.trim()) {
      brandOption = { brandKitId: brandKitIdParam.trim() };
    }

    const { projectId } = await ensureProjectForBrand(workspaceId, userId, brandOption);
    return NextResponse.json({ projectId });
  } catch (e) {
    if (e instanceof EnsureProjectError) {
      const status = e.code === 'FORBIDDEN' ? 403 : 404;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error('[GET default-project]', e);
    return NextResponse.json({ error: 'Failed to resolve project' }, { status: 500 });
  }
}
