'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

/** Top-bar sign out; keeps the same flow as the former sidebar control (no UI flash). */
export function SignOutControl() {
  const { user, signOut, loading, isSigningOut } = useAuth();

  if (loading || isSigningOut) {
    return (
      <div
        className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-white/10"
        aria-hidden
      />
    );
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut({ retainShellUntilNavigate: true });
    } catch {
      return;
    }
    window.location.assign('/auth?mode=signin');
  };

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-200/90 bg-white text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} aria-hidden />
    </button>
  );
}
