'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';

/**
 * Registration fields + Email/SSO row for the unified `/auth` screen (parent supplies headings).
 */
export function RegistrationSplitForm() {
  const router = useRouter();
  const { signUp, resendSignupConfirmation } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const inputShell =
    'relative flex items-center rounded-xl border border-slate-200 bg-[#FEFCE8] transition-shadow focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/25';
  const inputClass =
    'w-full bg-transparent py-3.5 pr-4 text-slate-900 placeholder:text-slate-400 outline-none text-[15px]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password, name);
      if (result.success) {
        const supabase = createClient();
        const {
          data: { session: newSession },
        } = await supabase.auth.getSession();
        if (newSession) {
          router.replace('/onboarding');
          return;
        }
        setMessage(
          'We sent a confirmation link to your email. Open the link to verify your address, then sign in to continue.'
        );
      } else {
        setError(result.error || 'Failed to create account');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900">
      <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
        <div
          className="flex-1 rounded-lg bg-brand-900 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
          aria-current="true"
        >
          Email &amp; password
        </div>
        <div
          className="flex-1 rounded-lg py-2.5 text-center text-sm font-medium text-slate-400 flex items-center justify-center gap-1.5 cursor-not-allowed select-none opacity-80"
          title="Coming soon"
        >
          <Building2 className="w-4 h-4 shrink-0" aria-hidden />
          Enterprise SSO
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <p className="font-medium text-slate-900">{message}</p>
            <p className="text-slate-600">
              If it does not arrive within a few minutes, check your junk or spam folder. You can also request another email below.
            </p>
            <button
              type="button"
              disabled={resendLoading || !email.trim()}
              onClick={async () => {
                setError('');
                setResendLoading(true);
                try {
                  const r = await resendSignupConfirmation(email);
                  if (r.success) {
                    setMessage(
                      'We sent another confirmation email. Please check your inbox and junk folder in the next few minutes.'
                    );
                  } else {
                    setError(r.error || 'Could not resend email');
                  }
                } finally {
                  setResendLoading(false);
                }
              }}
              className="text-left text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50 disabled:no-underline"
            >
              {resendLoading ? 'Sending…' : 'Resend confirmation email'}
            </button>
          </div>
        )}

        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-slate-800">
            Full name
          </label>
          <div className={inputShell}>
            <span className="pl-3.5 text-slate-400 pointer-events-none flex items-center">
              <User className="w-5 h-5" strokeWidth={1.75} aria-hidden />
            </span>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Chen"
              className={`${inputClass} pl-2`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-800">
            Email address
          </label>
          <div className={inputShell}>
            <span className="pl-3.5 text-slate-400 pointer-events-none flex items-center">
              <Mail className="w-5 h-5" strokeWidth={1.75} aria-hidden />
            </span>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={`${inputClass} pl-2`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-slate-800">
            Password
          </label>
          <div className={inputShell}>
            <span className="pl-3.5 text-slate-400 pointer-events-none flex items-center">
              <Lock className="w-5 h-5" strokeWidth={1.75} aria-hidden />
            </span>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pl-2 pr-2`}
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
        </div>

        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-slate-800">
            Confirm password
          </label>
          <div className={inputShell}>
            <span className="pl-3.5 text-slate-400 pointer-events-none flex items-center">
              <Lock className="w-5 h-5" strokeWidth={1.75} aria-hidden />
            </span>
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pl-2 pr-2`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="mr-3 rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? 'Creating account…' : 'Create account'}
          {!loading && <ArrowRight className="w-5 h-5" strokeWidth={2} aria-hidden />}
        </button>
      </form>
    </div>
  );
}
