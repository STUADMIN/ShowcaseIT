'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, AuthSession } from './config';
import { mapSupabaseUser, DEV_SESSION } from './config';
import { createClient } from '@/lib/supabase/client';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAuthenticated: false,
  loading: true,
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
        setSession({
          user: mapSupabaseUser(supaSession.user),
          expires: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600000).toISOString(),
        });
      } else if (process.env.NODE_ENV === 'development') {
        setSession(DEV_SESSION);
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

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        loading,
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
