import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  /** App shell placeholder; real workspace role comes from `workspace_members`. */
  role: 'admin' | 'member';
  workspaceId: string;
}

export interface AuthSession {
  user: AuthUser;
  expires: string;
}

export function mapSupabaseUser(supaUser: SupabaseUser): AuthUser {
  return {
    id: supaUser.id,
    name:
      supaUser.user_metadata?.full_name ||
      supaUser.user_metadata?.name ||
      supaUser.email?.split('@')[0] ||
      'User',
    email: supaUser.email || '',
    image: supaUser.user_metadata?.avatar_url || null,
    role: 'member',
    workspaceId: '',
  };
}
