'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Step = 1 | 2 | 3;

export function OnboardingWizard() {
  const { user, loading, needsOnboarding, refreshAppProfile, updateLocalUser } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.name) setDisplayName((prev) => (prev ? prev : user.name || ''));
  }, [user?.name]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth?mode=signin');
      return;
    }
    if (needsOnboarding === false) {
      router.replace('/');
    }
  }, [loading, user, needsOnboarding, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void fetch(`/api/users/${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { preferredWorkspaceId?: string | null } | null) => {
        if (cancelled || !data?.preferredWorkspaceId) return;
        void fetch(`/api/workspaces/${encodeURIComponent(data.preferredWorkspaceId)}`, {
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))

          .then((ws: { name?: string } | null) => {
            if (cancelled || !ws?.name) return;
            setWorkspaceName((prev) => (prev ? prev : ws.name || ''));
          });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const finish = useCallback(async () => {
    if (!user?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          workspaceName: workspaceName.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || 'Could not finish setup');
        return;
      }

      if (displayName.trim()) {
        updateLocalUser({ name: displayName.trim() });
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            full_name: displayName.trim(),
            name: displayName.trim(),
            display_name: displayName.trim(),
          },
        });
        if (metaErr) console.warn('Supabase profile metadata:', metaErr.message);
      }

      await refreshAppProfile();
      router.replace('/');
    } catch {
      setError('Something went wrong');
    } finally {
      setBusy(false);
    }
  }, [user?.id, displayName, workspaceName, refreshAppProfile, router, supabase, updateLocalUser]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-gray-400 text-sm">
        <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" aria-hidden />
        <p>{!user && !loading ? 'Redirecting…' : 'Loading…'}</p>
      </div>
    );
  }

  if (needsOnboarding === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-gray-400 text-sm">
        <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" aria-hidden />
        <p>Loading your profile…</p>
      </div>
    );
  }

  if (!needsOnboarding) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-gray-400 text-sm">
        <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" aria-hidden />
        <p>Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">ShowcaseIt</h1>
          <p className="text-gray-400">Set up your account in a minute</p>
        </div>

        <div className="flex gap-2 mb-8 justify-center">
          {([1, 2, 3] as const).map((n) => (
            <div
              key={n}
              className={`h-2 w-16 rounded-full transition-colors ${
                step >= n ? 'bg-brand-600' : 'bg-gray-800'
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-100 mb-1">Welcome</h2>
                <p className="text-sm text-gray-400">
                  You&apos;re signed in as <span className="text-gray-300">{user.email}</span>. We&apos;ll create your
                  workspace and you can start recording product walkthroughs.
                </p>
              </div>
              <button type="button" className="btn-primary w-full" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-100 mb-1">How should we call you?</h2>
              <p className="text-sm text-gray-400 mb-4">This appears in the app and on shared guides.</p>
              <label className="text-sm text-gray-400 block mb-1.5">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors"
                autoComplete="name"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn-primary flex-1" onClick={() => setStep(3)}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-100 mb-1">Name your workspace</h2>
              <p className="text-sm text-gray-400 mb-4">
                Teams and projects live under a workspace. You can invite others later from Team.
              </p>
              <label className="text-sm text-gray-400 block mb-1.5">Workspace name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Product"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep(2)} disabled={busy}>
                  Back
                </button>
                <button type="button" className="btn-primary flex-1" onClick={() => void finish()} disabled={busy}>
                  {busy ? 'Saving…' : 'Go to dashboard'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
