import { createClient } from '@/lib/supabase/server';

/** Supabase Auth user id from the request cookies, or null if not signed in. */
export async function getServerAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
