'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

function isAuthOrOnboardingPath(pathname: string) {
  return pathname.startsWith('/auth') || pathname.startsWith('/onboarding');
}

/** Routes that do not require a Supabase session (sign-in, cast sender, demos). */
function isPublicPath(pathname: string) {
  if (pathname.startsWith('/auth')) return true;
  if (pathname.startsWith('/cast/')) return true;
  if (pathname.startsWith('/walkthrough/preview')) return true;
  return false;
}

function GateSpinner({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-gray-400 text-sm">
      <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

/**
 * Redirects anonymous users away from protected routes; sends signed-in users who
 * have not finished onboarding to `/onboarding`.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading, needsOnboarding, isSigningOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isPublicPath(pathname)) return;
    if (!user?.id && !isSigningOut) {
      router.replace('/auth?mode=signin');
      return;
    }
    if (!user?.id) return;
    if (needsOnboarding === null) return;
    if (isAuthOrOnboardingPath(pathname)) return;
    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [loading, user?.id, needsOnboarding, pathname, router, isSigningOut]);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return <GateSpinner message="Loading your workspace…" />;
  }

  if (!user?.id && !isSigningOut) {
    return <GateSpinner message="Redirecting to sign in…" />;
  }

  const blocking =
    !!user?.id &&
    needsOnboarding === null &&
    !isAuthOrOnboardingPath(pathname);

  if (blocking) {
    return <GateSpinner message="Loading your workspace…" />;
  }

  return <>{children}</>;
}
