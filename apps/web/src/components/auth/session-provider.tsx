'use client';

import { OnboardingGate } from '@/components/auth/onboarding-gate';
import { WorkspaceBrandProvider } from '@/components/layout/workspace-brand-context';
import { AuthProvider } from '@/lib/auth/auth-context';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceBrandProvider>
        <OnboardingGate>{children}</OnboardingGate>
      </WorkspaceBrandProvider>
    </AuthProvider>
  );
}
