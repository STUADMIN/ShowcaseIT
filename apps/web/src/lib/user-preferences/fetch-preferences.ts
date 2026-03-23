import type { UserPreferencesDto } from '@/lib/user-preferences/types';

const inflight = new Map<string, Promise<UserPreferencesDto>>();

/** Dedupes concurrent GETs for the same user. */
export function fetchUserPreferences(userId: string): Promise<UserPreferencesDto> {
  let p = inflight.get(userId);
  if (!p) {
    p = fetch(`/api/users/${encodeURIComponent(userId)}/preferences`)
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<UserPreferencesDto>;
      })
      .finally(() => {
        inflight.delete(userId);
      });
    inflight.set(userId, p);
  }
  return p;
}
