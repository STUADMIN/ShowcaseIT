'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { LiquidGlassMain } from '@/components/ui/liquid-glass-main';

/** Sidebar + liquid-glass main area; respects Settings → workspace background. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen min-h-0 min-w-0 overflow-hidden">
      <Sidebar />
      <LiquidGlassMain className="min-h-0">{children}</LiquidGlassMain>
    </div>
  );
}
