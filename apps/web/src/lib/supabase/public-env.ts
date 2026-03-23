/**
 * Supabase URL + anon/publishable key for browser + SSR + middleware.
 * During `next build` static generation, env vars may be unset on Vercel until you add them;
 * we use placeholders only for that phase so prerender does not throw.
 */
export function getSupabasePublicEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (url && key) return { url, key };

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return {
      url: 'http://127.0.0.1:54321',
      key: 'sb_publishable_placeholder_only_during_next_build_not_for_runtime',
    };
  }

  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY must be set. ' +
      'Add them in Vercel → Project → Settings → Environment Variables.'
  );
}
