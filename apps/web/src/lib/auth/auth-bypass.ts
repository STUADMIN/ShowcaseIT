import type { AuthUser } from '@/lib/auth/config';

const TRUTHY = new Set(['1', 'true', 'yes']);

/**
 * Temporary local bypass: skip Supabase sign-in and use a fixed Prisma user id.
 * Enable with `NEXT_PUBLIC_SHOWCASEIT_AUTH_BYPASS=1` in `apps/web/.env.local`.
 * Never enable in production.
 */
export function isAuthBypassEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SHOWCASEIT_AUTH_BYPASS?.trim().toLowerCase();
  return TRUTHY.has(v ?? '');
}

/** Must match a row in `users` (e.g. `npx prisma db seed` creates `dev-user-1`). */
export function getAuthBypassUserId(): string {
  return (
    process.env.SHOWCASEIT_AUTH_BYPASS_USER_ID?.trim() ||
    process.env.NEXT_PUBLIC_SHOWCASEIT_AUTH_BYPASS_USER_ID?.trim() ||
    'dev-user-1'
  );
}

export function getBypassAuthUser(): AuthUser {
  const id = getAuthBypassUserId();
  return {
    id,
    name: 'Dev (auth bypass)',
    email: 'dev@localhost',
    image: null,
    role: 'admin',
    workspaceId: '',
  };
}
