'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'showcaseit:activeWorkspaceId';

/**
 * Remembers selected workspace in localStorage (Settings + Team).
 * Falls back to the first workspace in the list when stored id is missing.
 */
export function usePreferredWorkspaceId(
  workspaces: { id: string }[] | null | undefined
): [string, (id: string) => void] {
  const [workspaceId, setWorkspaceIdState] = useState('');

  useEffect(() => {
    if (!workspaces?.length) {
      setWorkspaceIdState('');
      return;
    }
    let stored: string | null = null;
    try {
      stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      stored = null;
    }
    const valid = stored && workspaces.some((w) => w.id === stored);
    setWorkspaceIdState(valid ? stored! : workspaces[0].id);
  }, [workspaces]);

  const setWorkspaceId = useCallback((id: string) => {
    setWorkspaceIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  return [workspaceId, setWorkspaceId];
}
