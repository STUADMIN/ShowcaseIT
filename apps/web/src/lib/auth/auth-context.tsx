'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { AuthUser, AuthSession } from './config';
import { mapSupabaseUser } from './config';
import { getBypassAuthUser, isAuthBypassEnabled } from '@/lib/auth/auth-bypass';
import { createClient } from '@/lib/supabase/client';
import { getAuthRedirectOrigin } from '@/lib/auth/auth-redirect-origin';
import { mfaLoginStepRequired, verifyTotpForLogin } from '@/lib/auth/mfa-helpers';
import { friendlySupabaseAuthError } from '@/lib/auth/supabase-request-error';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SignInResult =
  | { success: true; needsMfa: boolean }
  | { success: false; error?: string };

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /**
   * Whether the app profile still requires first-run onboarding (`/onboarding`).
   * `null` while loading or when signed out; gate should not redirect until boolean.
   */
  needsOnboarding: boolean | null;
  /** Re-fetch `/api/users/[id]` after completing onboarding or profile changes. */
  refreshAppProfile: () => Promise<void>;
  /** Merge into the current session user (e.g. after Settings profile / avatar save). */
  updateLocalUser: (partial: Partial<Pick<AuthUser, 'name' | 'image'>>) => void;
  /**
   * Request a sign-in email change (Supabase sends a confirmation link to the new address).
   */
  changeSignInEmail: (newEmail: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** Complete TOTP step after `signIn` returned `needsMfa: true`. */
  verifyMfaLogin: (code: string) => Promise<{ success: boolean; error?: string }>;
  /** Supabase sends a password reset link to `redirectTo` (see forgot-password page). */
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  /** Ask Supabase to send another signup confirmation email (same redirect as sign-up). */
  resendSignupConfirmation: (email: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Clear the Supabase session. Use `retainShellUntilNavigate` when you will hard-navigate
   * away immediately after (e.g. sidebar sign-out) so the UI does not flash logged-out chrome.
   */
  signOut: (options?: { retainShellUntilNavigate?: boolean }) => Promise<void>;
  /** True while signing out with `retainShellUntilNavigate` until the document unloads. */
  isSigningOut: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  needsOnboarding: null,
  refreshAppProfile: async () => {},
  updateLocalUser: () => {},
  changeSignInEmail: async () => ({ ok: false, error: 'Not available' }),
  signIn: async () => ({ success: false }),
  verifyMfaLogin: async () => ({ success: false }),
  resetPasswordForEmail: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  resendSignupConfirmation: async () => ({ success: false }),
  signOut: async () => {},
  isSigningOut: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const authBypass = useMemo(() => isAuthBypassEnabled(), []);
  const supabase: SupabaseClient | null = useMemo(
    () => (authBypass ? null : createClient()),
    [authBypass]
  );

  const loadNeedsOnboarding = useCallback(async (userId: string) => {
    setNeedsOnboarding(null);
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(userId)}`);
      if (!r.ok) {
        setNeedsOnboarding(false);
        return;
      }
      const j = (await r.json()) as { onboardingCompletedAt?: string | null };
      setNeedsOnboarding(!j.onboardingCompletedAt);
    } catch {
      setNeedsOnboarding(false);
    }
  }, []);

  const refreshAppProfile = useCallback(async () => {
    const id = session?.user?.id;
    if (!id) return;
    await loadNeedsOnboarding(id);
  }, [session?.user?.id, loadNeedsOnboarding]);

  useEffect(() => {
    if (authBypass) {
      const mapped = getBypassAuthUser();
      setSession({
        user: mapped,
        expires: new Date(Date.now() + 86400000 * 365).toISOString(),
      });
      void syncUserToDb(mapped.id, mapped.email, { full_name: mapped.name, name: mapped.name });
      void loadNeedsOnboarding(mapped.id);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session: supaSession } }) => {
      if (supaSession?.user) {
        const mapped = mapSupabaseUser(supaSession.user);
        setSession({
          user: mapped,
          expires: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600000).toISOString(),
        });
        await syncUserToDb(mapped.id, mapped.email, {
          full_name: mapped.name,
          name: mapped.name,
        });
        await loadNeedsOnboarding(mapped.id);
      } else {
        setNeedsOnboarding(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (supaSession?.user) {
        const u = supaSession.user;
        setSession({
          user: mapSupabaseUser(u),
          expires: supaSession.expires_at
            ? new Date(supaSession.expires_at * 1000).toISOString()
            : new Date(Date.now() + 3600000).toISOString(),
        });

        void (async () => {
          await syncUserToDb(u.id, u.email || '', u.user_metadata);
          await loadNeedsOnboarding(u.id);
        })();
      } else {
        setSession(null);
        setNeedsOnboarding(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [authBypass, supabase, loadNeedsOnboarding]);

  // Back/forward cache (bfcache) can restore a stale React tree while cookies still match reality.
  // Re-read the session so “Back” doesn’t show the wrong logged-in / logged-out state.
  useEffect(() => {
    if (typeof window === 'undefined' || authBypass || !supabase) return;

    const rehydrateFromCookies = () => {
      void supabase.auth.getSession().then(async ({ data: { session: supaSession } }) => {
        if (supaSession?.user) {
          const mapped = mapSupabaseUser(supaSession.user);
          setSession({
            user: mapped,
            expires: supaSession.expires_at
              ? new Date(supaSession.expires_at * 1000).toISOString()
              : new Date(Date.now() + 3600000).toISOString(),
          });
          await syncUserToDb(mapped.id, mapped.email, {
            full_name: mapped.name,
            name: mapped.name,
          });
          await loadNeedsOnboarding(mapped.id);
        } else {
          setSession(null);
          setNeedsOnboarding(null);
        }
      });
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) rehydrateFromCookies();
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [authBypass, supabase, loadNeedsOnboarding]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    if (authBypass) return { success: true, needsMfa: false };
    if (!supabase) return { success: false, error: 'Auth is not configured.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: friendlySupabaseAuthError(error.message) };
      }
      const needsMfa = await mfaLoginStepRequired(supabase);
      return { success: true, needsMfa };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      return { success: false, error: friendlySupabaseAuthError(msg) };
    }
  }, [authBypass, supabase]);

  const verifyMfaLogin = useCallback(
    async (code: string) => {
      if (authBypass) return { success: true };
      if (!supabase) return { success: false, error: 'Auth is not configured.' };
      const result = await verifyTotpForLogin(supabase, code);
      if (!result.ok) return { success: false, error: result.error };
      return { success: true };
    },
    [authBypass, supabase]
  );

  const resetPasswordForEmail = useCallback(
    async (email: string) => {
      if (authBypass) return { success: false, error: 'Password reset is disabled while auth bypass is on.' };
      if (!supabase) return { success: false, error: 'Auth is not configured.' };
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { success: false, error: 'Enter your email address.' };
      }
      const origin = getAuthRedirectOrigin();
      if (!origin) {
        return {
          success: false,
          error: 'Set NEXT_PUBLIC_APP_URL=http://localhost:3000 in .env.local (needed when dev uses hostname 0.0.0.0).',
        };
      }
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/auth/update-password')}`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (error) return { success: false, error: friendlySupabaseAuthError(error.message) };
      return { success: true };
    },
    [authBypass, supabase]
  );

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    if (authBypass) return { success: false, error: 'Sign up is disabled while auth bypass is on.' };
    if (!supabase) return { success: false, error: 'Auth is not configured.' };
    try {
      const origin = getAuthRedirectOrigin();
      const emailRedirectTo = origin
        ? `${origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`
        : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name || email.split('@')[0] },
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });
      if (error) return { success: false, error: friendlySupabaseAuthError(error.message) };
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      return { success: false, error: friendlySupabaseAuthError(msg) };
    }
  }, [authBypass, supabase]);

  const resendSignupConfirmation = useCallback(
    async (email: string) => {
      if (authBypass) return { success: false, error: 'Sign up is disabled while auth bypass is on.' };
      if (!supabase) return { success: false, error: 'Auth is not configured.' };
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { success: false, error: 'Enter the email you used to register.' };
      }
      const origin = getAuthRedirectOrigin();
      const emailRedirectTo = origin
        ? `${origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`
        : undefined;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
        options: emailRedirectTo ? { emailRedirectTo } : {},
      });
      if (error) return { success: false, error: friendlySupabaseAuthError(error.message) };
      return { success: true };
    },
    [authBypass, supabase]
  );

  const signOut = useCallback(
    async (options?: { retainShellUntilNavigate?: boolean }) => {
      if (authBypass) return;
      if (!supabase) return;
      const retainShell = options?.retainShellUntilNavigate === true;
      if (retainShell) setIsSigningOut(true);
      try {
        await supabase.auth.signOut();
        setSession(null);
        setNeedsOnboarding(null);
      } catch (err) {
        if (retainShell) setIsSigningOut(false);
        throw err;
      }
    },
    [authBypass, supabase]
  );

  const changeSignInEmail = useCallback(
    async (newEmail: string) => {
      if (authBypass) return { ok: false, error: 'Email change is disabled while auth bypass is on.' };
      if (!supabase) return { ok: false, error: 'Auth is not configured.' };
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
          error: 'No active session. Sign in again, then try changing your email.',
        };
      }

      const current = (supaSession.user.email || '').toLowerCase();
      if (trimmed === current) {
        return { ok: false, error: 'That is already your sign-in email.' };
      }

      const origin = getAuthRedirectOrigin();
      const emailRedirectTo = origin
        ? `${origin}/auth/callback?next=${encodeURIComponent('/settings')}`
        : undefined;

      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        emailRedirectTo ? { emailRedirectTo } : {}
      );

      if (error) return { ok: false, error: friendlySupabaseAuthError(error.message) };
      return { ok: true };
    },
    [authBypass, supabase]
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
        needsOnboarding,
        refreshAppProfile,
        updateLocalUser,
        changeSignInEmail,
        signIn,
        verifyMfaLogin,
        resetPasswordForEmail,
        signUp,
        resendSignupConfirmation,
        signOut,
        isSigningOut,
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
