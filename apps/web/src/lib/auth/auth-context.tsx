'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, AuthSession } from './config';
import { mapSupabaseUser, DEV_SESSION, DEV_USER } from './config';
import { createClient } from '@/lib/supabase/client';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Merge into the current session user (e.g. after Settings profile / avatar save). */
  updateLocalUser: (partial: Partial<Pick<AuthUser, 'name' | 'image'>>) => void;
  /**
   * Request a sign-in email change (Supabase sends a confirmation link to the new address).
   * No-op for the local dev demo session without a real Supabase user.
   */
  changeSignInEmail: (newEmail: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  updateLocalUser: () => {},
  changeSignInEmail: async () => ({ ok: false, error: 'Not available' }),
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: supaSession } }) => {
      if (supaSession?.user) {
        const mapped = mapSupabaseUser(supaSession.user);
        setSession({
          user: mapped,
          expires: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600000).toISOString(),
        });
        syncUserToDb(mapped.id, mapped.email, {
          full_name: mapped.name,
          name: mapped.name,
        });
      } else if (process.env.NODE_ENV === 'development') {
        setSession(DEV_SESSION);
        syncUserToDb(DEV_USER.id, DEV_USER.email, { name: DEV_USER.name, full_name: DEV_USER.name });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (supaSession?.user) {
        setSession({
          user: mapSupabaseUser(supaSession.user),
          expires: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600000).toISOString(),
        });

        syncUserToDb(supaSession.user.id, supaSession.user.email || '', supaSession.user.user_metadata);
      } else {
        if (process.env.NODE_ENV === 'development') {
          setSession(DEV_SESSION);
          syncUserToDb(DEV_USER.id, DEV_USER.email, { name: DEV_USER.name, full_name: DEV_USER.name });
        } else {
          setSession(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (process.env.NODE_ENV === 'development' && password === 'demo') {
        setSession(DEV_SESSION);
        syncUserToDb(DEV_USER.id, DEV_USER.email, { name: DEV_USER.name, full_name: DEV_USER.name });
        return { success: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name || email.split('@')[0] } },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const changeSignInEmail = useCallback(
    async (newEmail: string) => {
      const trimmed = newEmail.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }

      const {
        data: { session: supaSession },
      } = await supabase.auth.getSession();

      if (!supaSession?.user) {
        return {
          ok: false,
          error:
            'No active Supabase session. Sign out and sign in with email/password (not the local demo shortcut), then try again.',
        };
      }

      if (supaSession.user.id === DEV_USER.id) {
        return {
          ok: false,
          error:
            'The local demo account cannot change email. Use Sign up to create a real account, or sign in with Supabase email/password.',
        };
      }

      const current = (supaSession.user.email || '').toLowerCase();
      if (trimmed === current) {
        return { ok: false, error: 'That is already your sign-in email.' };
      }

      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin.replace(/\/$/, '')
          : (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const emailRedirectTo = origin
        ? `${origin}/auth/callback?next=${encodeURIComponent('/settings')}`
        : undefined;

      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        emailRedirectTo ? { emailRedirectTo } : {}
      );

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [supabase]
  );

  const updateLocalUser = useCallback((partial: Partial<Pick<AuthUser, 'name' | 'image'>>) => {
    setSession((prev) => {
      if (!prev?.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...partial },
      };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        loading,
        updateLocalUser,
        changeSignInEmail,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

async function syncUserToDb(id: string, email: string, metadata: Record<string, unknown>) {
  try {
    await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email, name: metadata?.full_name || metadata?.name || email.split('@')[0] }),
    });
  } catch {
    // Non-critical; user row will be created on next API call
  }
}
