import type { Metadata } from 'next';
import { SessionProvider } from '@/components/auth/session-provider';
import { WorkspaceEffectsSync } from '@/components/layout/workspace-effects-sync';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShowcaseIt - Beautiful Branded User Manuals',
  description:
    'Create stunning user manuals, interactive walkthroughs, and documentation from screen recordings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <SessionProvider>
          <WorkspaceEffectsSync />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
