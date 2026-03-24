'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPatch } from '@/hooks/use-api';
import { fetchUserPreferences } from '@/lib/user-preferences/fetch-preferences';

const LEGACY_STORAGE_KEY = 'showcaseit:activeBrandKitByWorkspace';

function parseStored(json: string | null): Record<string, string | null> | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    return o as Record<string, string | null>;
  } catch {
    return null;
  }
}

/**
 * Per-workspace “active brand” for filtering guides/recordings and default project.
 * `null` = all brands (no filter). Persisted in `users.ui_preferences` when signed in.
 */
export function useActiveBrandKitId(
  workspaceId: string | undefined,
  userId: string | undefined,
  /** When defined (including empty array), validates the stored id against this workspace’s kits */
  brandKitIdsInWorkspace: string[] | undefined
): [string | null, (id: string | null) => void] {
  const [brandKitId, setBrandKitIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setBrandKitIdState(null);
      return;
    }

    if (!userId) {
      try {
        const map = parseStored(
          typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null
        );
        const v = map?.[workspaceId];
        setBrandKitIdState(typeof v === 'string' && v.trim() ? v.trim() : null);
      } catch {
        setBrandKitIdState(null);
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const prefs = await fetchUserPreferences(userId);
        const map = prefs.uiPreferences?.activeBrandKitByWorkspace;
        let id: string | null = null;
        if (map && Object.prototype.hasOwnProperty.call(map, workspaceId)) {
          const raw = map[workspaceId];
          if (typeof raw === 'string' && raw.trim()) id = raw.trim();
          else id = null;
        }
        if (!cancelled) setBrandKitIdState(id);
      } catch {
        const map = parseStored(
          typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null
        );
        const v = map?.[workspaceId];
        if (!cancelled) setBrandKitIdState(typeof v === 'string' && v.trim() ? v.trim() : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  useEffect(() => {
    if (brandKitIdsInWorkspace === undefined || brandKitId === null) return;
    if (!brandKitIdsInWorkspace.includes(brandKitId)) {
      setBrandKitIdState(null);
      if (userId && workspaceId) {
        void apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
          uiPreferences: {
            activeBrandKitByWorkspace: { [workspaceId]: null },
          },
        }).catch(() => {});
      }
    }
  }, [brandKitIdsInWorkspace, brandKitId, userId, workspaceId]);

  const setActiveBrandKitId = useCallback(
    (id: string | null) => {
      if (!workspaceId) return;
      setBrandKitIdState(id);
      if (!userId) {
        try {
          const map = parseStored(localStorage.getItem(LEGACY_STORAGE_KEY)) ?? {};
          if (id && id.trim()) map[workspaceId] = id.trim();
          else delete map[workspaceId];
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(map));
        } catch {
          /* ignore */
        }
        return;
      }
      void apiPatch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
        uiPreferences: {
          activeBrandKitByWorkspace: { [workspaceId]: id },
        },
      }).catch(() => {});
    },
    [userId, workspaceId]
  );

  return [brandKitId, setActiveBrandKitId];
}
