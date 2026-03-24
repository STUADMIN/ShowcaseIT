import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeAuthRedirectOrigin } from '@/lib/auth/auth-redirect-origin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const nextRaw = searchParams.get('next') ?? '/';
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';

  const siteOrigin = normalizeAuthRedirectOrigin(request.url);
  if (!siteOrigin) {
    return NextResponse.json({ error: 'Invalid request URL' }, { status: 400 });
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${siteOrigin}/auth?error=auth_callback_error`);
}
