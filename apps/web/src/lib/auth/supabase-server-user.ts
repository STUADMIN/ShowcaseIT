import { isAuthBypassEnabled, getAuthBypassUserId } from '@/lib/auth/auth-bypass';
import { createClient } from '@/lib/supabase/server';

/** Supabase Auth user id from the request cookies, or null if not signed in. */
export async function getServerAuthUserId(): Promise<string | null> {
  if (isAuthBypassEnabled()) {
    return getAuthBypassUserId();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
