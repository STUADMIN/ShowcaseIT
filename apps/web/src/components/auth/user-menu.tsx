'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';

export function UserMenu() {
  const { user, loading, isSigningOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (loading || isSigningOut) {
    return (
      <div
        className="w-full flex items-center gap-3 p-2.5 rounded-xl animate-pulse"
        aria-busy="true"
        aria-label="Loading account"
      >
        <div className="w-9 h-9 rounded-full bg-gray-700 flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 bg-gray-700 rounded-md w-[55%]" />
          <div className="h-3 bg-gray-700 rounded-md w-[80%]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full space-y-2">
        <Link
          href="/auth?mode=signin"
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/auth?mode=signup"
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-brand-600/10 text-brand-400 text-sm font-medium hover:bg-brand-600/20 transition-colors border border-brand-600/20"
        >
          Register
        </Link>
      </div>
    );
  }

  const initials = (user.name || user.email)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user.image ? (
            <img src={user.image} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <Link
              href="/settings"
              onClick={() => setShowMenu(false)}
              className="block w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/team"
              onClick={() => setShowMenu(false)}
              className="block w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Team Management
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
