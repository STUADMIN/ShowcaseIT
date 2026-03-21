'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { LiquidGlassMain } from '@/components/ui/liquid-glass-main';

/** Sidebar + liquid-glass main area; respects Settings → workspace background. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <LiquidGlassMain>{children}</LiquidGlassMain>
    </div>
  );
}
