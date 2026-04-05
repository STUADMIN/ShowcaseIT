/**
 * Map low-level fetch/network failures from @supabase/supabase-js into actionable copy.
 */
export function friendlySupabaseAuthError(message: string): string {
  const m = message.trim().toLowerCase();
  if (
    m === 'failed to fetch' ||
    m.includes('networkerror when attempting to fetch') ||
    m === 'load failed' ||
    m.includes('network request failed')
  ) {
    return (
      'Could not reach Supabase. In apps/web/.env.local set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY from Supabase → Project Settings → API. ' +
      'If you use Supabase locally, run `supabase start` first. Check VPN, firewall, and ad blockers.'
    );
  }
  return message;
}
