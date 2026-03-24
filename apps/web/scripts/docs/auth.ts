/**
 * Supabase sign-in helper for Playwright.
 * Returns cookie name/value pairs to inject into a browser context
 * so pages see an authenticated session without a fragile UI login flow.
 */

import { createClient } from '@supabase/supabase-js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  /** Full session JSON for cookie injection. */
  sessionJson: string;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key} — check .env / .env.local`);
  return v;
}

export async function signIn(
  email?: string,
  password?: string
): Promise<AuthResult> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');

  const e = email ?? process.env.DOCS_AUTH_EMAIL;
  const p = password ?? process.env.DOCS_AUTH_PASSWORD;
  if (!e || !p) {
    throw new Error(
      'Provide DOCS_AUTH_EMAIL + DOCS_AUTH_PASSWORD in env, or pass email/password arguments.'
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: e,
    password: p,
  });

  if (error || !data.session) {
    throw new Error(`Supabase sign-in failed: ${error?.message ?? 'no session returned'}`);
  }

  const session = data.session;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
    sessionJson: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      user: session.user,
    }),
  };
}

/**
 * Build the cookie objects that `@supabase/ssr` expects when reading
 * the session from cookies in a Next.js server component / route handler.
 *
 * The SSR package stores the session as chunked cookies named
 * `sb-<project-ref>-auth-token` (or `.0`, `.1`, etc. for large tokens).
 * We chunk the payload at 3500 bytes to match the SSR library's behaviour.
 */
export function buildSupabaseCookies(
  tokens: AuthResult,
  baseUrl: string
): Array<{ name: string; value: string; domain: string; path: string }> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const baseName = `sb-${projectRef}-auth-token`;
  const domain = new URL(baseUrl).hostname;
  const payload = tokens.sessionJson;

  const CHUNK_SIZE = 3500;
  const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [];

  if (payload.length <= CHUNK_SIZE) {
    cookies.push({ name: baseName, value: payload, domain, path: '/' });
  } else {
    const chunks = Math.ceil(payload.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      cookies.push({
        name: `${baseName}.${i}`,
        value: payload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        domain,
        path: '/',
      });
    }
  }

  return cookies;
}
