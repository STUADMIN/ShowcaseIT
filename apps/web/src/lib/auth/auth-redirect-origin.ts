function authRedirectOriginFromEnv(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
}

/**
 * Normalize the site origin for redirects (server or client).
 * `next dev --hostname 0.0.0.0` makes the incoming URL `http://0.0.0.0:3000/...`; browsers cannot follow redirects to that host (`ERR_ADDRESS_INVALID`).
 *
 * Prefer **`NEXT_PUBLIC_APP_URL`** (e.g. `http://localhost:3000`) in `.env.local`.
 */
export function normalizeAuthRedirectOrigin(requestUrl: string): string {
  const fromEnv = authRedirectOriginFromEnv();
  if (fromEnv) return fromEnv;

  try {
    const url = new URL(requestUrl);
    const h = url.hostname;
    if (h === '0.0.0.0' || h === '[::]' || h === '::') {
      url.hostname = 'localhost';
      return url.origin;
    }
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Origin used in Supabase `redirectTo` / `emailRedirectTo` for email links and OAuth callbacks.
 *
 * `npm run dev` uses `--hostname 0.0.0.0`, so `window.location.origin` becomes `http://0.0.0.0:3000`.
 * Browsers treat that as invalid for normal navigation → confirmation links break.
 *
 * Prefer **`NEXT_PUBLIC_APP_URL`** (e.g. `http://localhost:3000`) in `.env.local` for local dev.
 */
export function getAuthRedirectOrigin(): string {
  const fromEnv = authRedirectOriginFromEnv();
  if (typeof window === 'undefined') {
    return fromEnv;
  }
  if (fromEnv) return fromEnv;

  return normalizeAuthRedirectOrigin(window.location.href);
}
