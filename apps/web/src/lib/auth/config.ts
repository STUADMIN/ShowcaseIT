import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
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
    role: 'owner',
    workspaceId: '',
  };
}

export const DEV_USER: AuthUser = {
  id: 'dev-user-1',
  name: 'Demo User',
  email: 'demo@showcaseit.app',
  image: null,
  role: 'owner',
  workspaceId: 'ws-1',
};

export const DEV_SESSION: AuthSession = {
  user: DEV_USER,
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};
