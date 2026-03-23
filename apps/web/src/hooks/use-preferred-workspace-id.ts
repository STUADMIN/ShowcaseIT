'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPatch } from '@/hooks/use-api';
import { fetchUserPreferences } from '@/lib/user-preferences/fetch-preferences';

const LEGACY_STORAGE_KEY = 'showcaseit:activeWorkspaceId';

/**
 * Active workspace: stored in Postgres (`users.preferred_workspace_id`) when signed in
 * so it syncs across devices. Falls back to legacy localStorage when logged out (e.g. dev).
 */
export function usePreferredWorkspaceId(
  workspaces: { id: string }[] | null | undefined,
  userId: string | undefined
): [string, (id: string) => void] {
  const [workspaceId, setWorkspaceIdState] = useState('');

  useEffect(() => {
    if (!workspaces?.length) {
      setWorkspaceIdState('');
      return;
    }

    if (!userId) {
      let stored: string | null = null;
      try {
        stored = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
      } catch {
        stored = null;
      }
      const valid = stored && workspaces.some((w) => w.id === stored);
      setWorkspaceIdState(valid ? stored! : workspaces[0].id);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const prefs = await fetchUserPreferences(userId);
        let id = prefs.preferredWorkspaceId || '';
        if (id && !workspaces.some((w) => w.id === id)) {
          id = '';
        }
        if (!id) {
          let stored: string | null = null;
          try {
            stored = localStorage.getItem(LEGACY_STORAGE_KEY);
          } catch {
            stored = null;
          }
          const legacyValid = stored && workspaces.some((w) => w.id === stored);
          if (legacyValid && stored) {
            id = stored;
            try {
              await apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
                preferredWorkspaceId: id,
              });
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch {
              /* keep local selection if API fails */
            }
          } else {
            id = workspaces[0].id;
          }
        }
        if (!cancelled) setWorkspaceIdState(id);
      } catch {
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(LEGACY_STORAGE_KEY);
        } catch {
          stored = null;
        }
        const valid = stored && workspaces.some((w) => w.id === stored);
        if (!cancelled) setWorkspaceIdState(valid ? stored! : workspaces[0].id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaces, userId]);

  const setPreferredWorkspaceId = useCallback(
    (id: string) => {
      setWorkspaceIdState(id);
      if (!userId) {
        try {
          localStorage.setItem(LEGACY_STORAGE_KEY, id);
        } catch {
          /* ignore */
        }
        return;
      }
      void apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
        preferredWorkspaceId: id,
      }).catch(() => {});
    },
    [userId]
  );

  return [workspaceId, setPreferredWorkspaceId];
}
