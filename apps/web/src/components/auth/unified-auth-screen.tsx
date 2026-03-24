'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthMarketingAside } from '@/components/auth/auth-marketing-aside';
import { RegistrationSplitForm } from '@/components/auth/registration-split-form';
import { useAuth } from '@/lib/auth/auth-context';

const INPUT_SHELL =
  'relative flex items-center rounded-xl border border-slate-200 bg-[#FEFCE8] transition-shadow focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/25';
const INPUT_CLASS =
  'w-full bg-transparent py-3.5 pr-4 text-slate-900 placeholder:text-slate-400 outline-none text-[15px]';

/**
 * Single auth entry: split layout with Sign in | Create account (no separate /auth/signin page).
 */
export function UnifiedAuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, verifyMfaLogin, signOut } = useAuth();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(() =>
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const syncModeFromUrl = useCallback(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') setAuthMode('signup');
    else if (m === 'signin') setAuthMode('signin');
  }, [searchParams]);

  useEffect(() => {
    syncModeFromUrl();
  }, [syncModeFromUrl]);

  const searchKey = searchParams.toString();
  useEffect(() => {
    const q = new URLSearchParams(searchKey);
    if (q.get('message') === 'password_updated') {
      setMessage('Your password was updated. Sign in with your new password.');
    }
    if (q.get('error') === 'auth_callback_error') {
      setError(
        'That link could not complete sign-in. It may have expired or already been used. Try signing in again, or use Create account with the same email to request a new confirmation message.'
      );
    }
  }, [searchKey]);

  // Supabase often puts magic-link / email errors in the hash (#error=...&error_code=...) — not visible to the server.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const hp = new URLSearchParams(raw);
    const errorCode = hp.get('error_code');
    const description = hp.get('error_description');
    const decoded = description
      ? decodeURIComponent(description.replace(/\+/g, ' '))
      : '';

    if (errorCode === 'otp_expired' || hp.get('error') === 'access_denied') {
      setError(
        decoded ||
          'This email link has expired or is no longer valid. Request a new confirmation email or create your account again.'
      );
    }

    const path = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', path);
  }, []);

  const setTab = (m: 'signin' | 'signup') => {
    setAuthMode(m);
    setError('');
    setMessage('');
    setMfaRequired(false);
    setMfaCode('');
    router.replace(`/auth?mode=${m}`, { scroll: false });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setError(result.error || 'Invalid email or password');
      } else if (result.needsMfa) {
        setMfaRequired(true);
        setMfaCode('');
      } else {
        router.replace('/');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verifyMfaLogin(mfaCode);
      if (result.success) {
        router.replace('/');
      } else {
        setError(result.error || 'Invalid code');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentAccount = async () => {
    await signOut();
    setMfaRequired(false);
    setMfaCode('');
    setPassword('');
    setError('');
    setMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <AuthMarketingAside />

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12 sm:px-10 lg:px-12 lg:py-16">
        <div className="w-full max-w-[440px] text-slate-900">
          {mfaRequired ? (
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gradient">Two-step verification</h2>
              <p className="mt-2 text-slate-500 text-[15px]">
                Enter the 6-digit code from your authenticator app for{' '}
                <span className="text-slate-700 font-medium">{email}</span>.
              </p>
              <form onSubmit={handleMfaSubmit} className="mt-8 space-y-5">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="mfa-code" className="mb-1.5 block text-sm font-medium text-slate-800">
                    Authentication code
                  </label>
                  <div className={INPUT_SHELL}>
                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      className={`${INPUT_CLASS} px-4 tracking-widest font-mono text-center`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Continue'}
                  {!loading && <ArrowRight className="w-5 h-5" strokeWidth={2} aria-hidden />}
                </button>
              </form>
              <button
                type="button"
                className="mt-6 w-full text-center text-sm text-slate-500 hover:text-slate-700"
                onClick={() => void handleUseDifferentAccount()}
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight text-gradient">
                {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-2 text-slate-500 text-[15px] leading-relaxed">
                {authMode === 'signin'
                  ? 'Sign in to create beautiful user manuals.'
                  : 'Start your workspace and turn recordings into branded guides.'}
              </p>

              <div className="mt-8 flex rounded-xl bg-gray-100 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    authMode === 'signin'
                      ? 'bg-brand-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    authMode === 'signup'
                      ? 'bg-brand-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Create account
                </button>
              </div>

              {authMode === 'signin' ? (
                <form onSubmit={handleSignIn} className="mt-8 space-y-5">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {message && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      {message}
                    </div>
                  )}

                  <div>
                    <label htmlFor="si-email" className="mb-1.5 block text-sm font-medium text-slate-800">
                      Email address
                    </label>
                    <div className={INPUT_SHELL}>
                      <span className="pl-3.5 text-slate-400 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <input
                        id="si-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className={`${INPUT_CLASS} pl-2`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="si-password" className="mb-1.5 block text-sm font-medium text-slate-800">
                      Password
                    </label>
                    <div className={INPUT_SHELL}>
                      <span className="pl-3.5 text-slate-400 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <input
                        id="si-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className={`${INPUT_CLASS} pl-2 pr-2`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="mr-3 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-right">
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Forgot password?
                      </Link>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                    {!loading && <ArrowRight className="w-5 h-5" strokeWidth={2} aria-hidden />}
                  </button>
                </form>
              ) : (
                <div className="mt-6">
                  <RegistrationSplitForm />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
