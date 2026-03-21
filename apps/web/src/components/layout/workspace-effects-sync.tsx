'use client';

import { useEffect } from 'react';
import { useLiquidGlassPrefs } from '@/hooks/use-liquid-glass-prefs';
import {
  WORKSPACE_CELEBRATE_EVENT,
  fireWorkspaceCelebration,
} from '@/lib/ui/workspace-celebrate';

/**
 * Syncs workspace visual flags to <html data-*> and listens for celebration events.
 */
export function WorkspaceEffectsSync() {
  const { prefs } = useLiquidGlassPrefs();

  useEffect(() => {
    const html = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    html.dataset.siCardGlow = prefs.cardHoverGlow ? '1' : '0';
    html.dataset.siListStagger =
      prefs.listEntranceAnimations && !reduceMotion ? '1' : '0';

    return () => {
      delete html.dataset.siCardGlow;
      delete html.dataset.siListStagger;
    };
  }, [prefs.cardHoverGlow, prefs.listEntranceAnimations]);

  useEffect(() => {
    if (!prefs.celebrateOnSuccess) return;

    const onCelebrate = () => {
      if (!prefs.celebrateOnSuccess) return;
      fireWorkspaceCelebration();
    };

    window.addEventListener(WORKSPACE_CELEBRATE_EVENT, onCelebrate);
    return () => window.removeEventListener(WORKSPACE_CELEBRATE_EVENT, onCelebrate);
  }, [prefs.celebrateOnSuccess]);

  return null;
}
