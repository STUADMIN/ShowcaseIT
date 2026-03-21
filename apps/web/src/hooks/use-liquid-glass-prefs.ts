'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type LiquidGlassPrefs,
  LIQUID_GLASS_DEFAULTS,
  LIQUID_GLASS_STORAGE_KEY,
  loadLiquidGlassPrefs,
  saveLiquidGlassPrefs,
} from '@/lib/ui/liquid-glass-prefs';

export function useLiquidGlassPrefs() {
  const [prefs, setPrefsState] = useState<LiquidGlassPrefs>(LIQUID_GLASS_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefsState(loadLiquidGlassPrefs());
    setHydrated(true);

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
  }, []);

  const setPrefs = useCallback((next: LiquidGlassPrefs | ((prev: LiquidGlassPrefs) => LiquidGlassPrefs)) => {
    setPrefsState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      saveLiquidGlassPrefs(resolved);
      return resolved;
    });
  }, []);

  return { prefs, setPrefs, hydrated };
}
