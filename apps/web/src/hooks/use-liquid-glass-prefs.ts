'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { apiPatch } from '@/hooks/use-api';
import { fetchUserPreferences } from '@/lib/user-preferences/fetch-preferences';
import {
  type LiquidGlassPrefs,
  LIQUID_GLASS_DEFAULTS,
  LIQUID_GLASS_STORAGE_KEY,
  loadLiquidGlassPrefs,
  saveLiquidGlassPrefs,
} from '@/lib/ui/liquid-glass-prefs';

const SAVE_DEBOUNCE_MS = 550;

/**
 * Workspace visual prefs: Postgres (`users.ui_preferences.liquidGlass`) when signed in;
 * localStorage when logged out (e.g. dev demo).
 */
export function useLiquidGlassPrefs() {
  const { user } = useAuth();
  const userId = user?.id;
  const [prefs, setPrefsState] = useState<LiquidGlassPrefs>(LIQUID_GLASS_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistPrefs = useCallback(
    (next: LiquidGlassPrefs) => {
      if (!userId) {
        saveLiquidGlassPrefs(next);
        return;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
          uiPreferences: { liquidGlass: next },
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [userId]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) {
        setPrefsState(loadLiquidGlassPrefs());
        setHydrated(true);
        return;
      }

      try {
        const p = await fetchUserPreferences(userId);
        const fromApi = p.uiPreferences?.liquidGlass;
        let localMerged: LiquidGlassPrefs | null = null;
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(LIQUID_GLASS_STORAGE_KEY) : null;
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<LiquidGlassPrefs>;
            localMerged = { ...LIQUID_GLASS_DEFAULTS, ...parsed };
          }
        } catch {
          localMerged = null;
        }

        const hasApiGlass = fromApi && Object.keys(fromApi).length > 0;
        if (!hasApiGlass && localMerged) {
          if (!cancelled) setPrefsState(localMerged);
          try {
            await apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
              uiPreferences: { liquidGlass: localMerged },
            });
            localStorage.removeItem(LIQUID_GLASS_STORAGE_KEY);
          } catch {
            /* keep local */
          }
        } else {
          const merged = { ...LIQUID_GLASS_DEFAULTS, ...(fromApi || {}) };
          if (!cancelled) setPrefsState(merged);
        }
      } catch {
        if (!cancelled) setPrefsState(loadLiquidGlassPrefs());
      }
      if (!cancelled) setHydrated(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (userId) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LIQUID_GLASS_STORAGE_KEY) {
        setPrefsState(loadLiquidGlassPrefs());
      }
    };
    const onCustom = () => setPrefsState(loadLiquidGlassPrefs());
    window.addEventListener('storage', onStorage);
    window.addEventListener('showcaseit:liquid-glass-prefs', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('showcaseit:liquid-glass-prefs', onCustom);
    };
  }, [userId]);

  const setPrefs = useCallback(
    (next: LiquidGlassPrefs | ((prev: LiquidGlassPrefs) => LiquidGlassPrefs)) => {
      setPrefsState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        persistPrefs(resolved);
        return resolved;
      });
    },
    [persistPrefs]
  );

  return { prefs, setPrefs, hydrated };
}
