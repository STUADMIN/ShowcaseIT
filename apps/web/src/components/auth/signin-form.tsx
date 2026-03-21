'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (result.success) {
          router.push('/');
        } else {
          setError(result.error || 'Invalid email or password');
        }
      } else {
        const result = await signUp(email, password, name);
        if (result.success) {
          setMessage('Check your email for a confirmation link, then sign in.');
          setMode('signin');
        } else {
          setError(result.error || 'Failed to create account');
        }
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-8">
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'signin' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'signup' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3">
            {message}
          </div>
        )}

        {mode === 'signup' && (
          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors"
            />
          </div>
        )}

        <div>
          <label className="text-sm text-gray-400 block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Create a password (min 6 chars)' : 'Enter password'}
            required
            minLength={mode === 'signup' ? 6 : undefined}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 outline-none focus:border-brand-600 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading
            ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
            : (mode === 'signin' ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      {process.env.NODE_ENV === 'development' && mode === 'signin' && (
        <p className="text-center text-xs text-gray-600 mt-6">
          Dev mode: use any email with password <code className="text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">demo</code>
        </p>
      )}
    </div>
  );
}
