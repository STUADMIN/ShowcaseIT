'use client';

import { SignOutControl } from '@/components/auth/sign-out-control';
import { Sidebar } from '@/components/layout/sidebar';
import { LiquidGlassMain } from '@/components/ui/liquid-glass-main';

/** Sidebar + liquid-glass main area; respects Settings → workspace background. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 min-w-0 overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-end gap-3 border-b border-gray-800/80 bg-gray-950/90 px-4 py-2.5 backdrop-blur-md">
          <SignOutControl />
        </header>
        <LiquidGlassMain className="min-h-0 min-w-0 flex-1">{children}</LiquidGlassMain>
      </div>
    </div>
  );
}
