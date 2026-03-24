import { Suspense } from 'react';
import { UnifiedAuthScreen } from '@/components/auth/unified-auth-screen';

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="h-10 w-10 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <UnifiedAuthScreen />
    </Suspense>
  );
}
