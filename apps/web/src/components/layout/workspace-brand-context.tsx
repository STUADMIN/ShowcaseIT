'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useApi } from '@/hooks/use-api';
import { usePreferredWorkspaceId } from '@/hooks/use-preferred-workspace-id';
import { useActiveBrandKitId } from '@/hooks/use-active-brand-kit-id';

export type WorkspaceBrandWorkspace = { id: string; name: string; plan?: string };

export type WorkspaceBrandKitSummary = { id: string; name: string };

export type WorkspaceBrandContextValue = {
  workspaces: WorkspaceBrandWorkspace[] | null;
  workspacesLoading: boolean;
  refetchWorkspaces: () => Promise<void>;
  preferredWorkspaceId: string;
  setPreferredWorkspaceId: (id: string) => void;
  activeBrandKitId: string | null;
  setActiveBrandKitId: (id: string | null) => void;
  brandKits: WorkspaceBrandKitSummary[] | null;
  brandKitsLoading: boolean;
  refetchBrandKits: () => Promise<void>;
  recordingProjectId: string | null;
  recordingProjectLoading: boolean;
};

const WorkspaceBrandContext = createContext<WorkspaceBrandContextValue | null>(null);

export function WorkspaceBrandProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const wsUrl = user?.id ? `/api/workspaces?userId=${encodeURIComponent(user.id)}` : '';
  const {
    data: workspaces,
    loading: workspacesLoading,
    refetch: refetchWorkspaces,
  } = useApi<WorkspaceBrandWorkspace[]>({ url: wsUrl });

  const [preferredWorkspaceId, setPreferredWorkspaceId] = usePreferredWorkspaceId(workspaces, user?.id);

  const brandUrl = preferredWorkspaceId
    ? `/api/brand-kits?workspaceId=${encodeURIComponent(preferredWorkspaceId)}`
    : '';
  const {
    data: brandKits,
    loading: brandKitsLoading,
    refetch: refetchBrandKits,
  } = useApi<WorkspaceBrandKitSummary[]>({ url: brandUrl });

  const kitIds = useMemo(
    () => (Array.isArray(brandKits) ? brandKits.map((k) => k.id) : undefined),
    [brandKits]
  );

  const [activeBrandKitId, setActiveBrandKitId] = useActiveBrandKitId(
    preferredWorkspaceId || undefined,
    user?.id,
    kitIds
  );

  const [recordingProjectId, setRecordingProjectId] = useState<string | null>(null);
  const [recordingProjectLoading, setRecordingProjectLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !preferredWorkspaceId) {
      setRecordingProjectId(null);
      setRecordingProjectLoading(false);
      return;
    }
    let cancelled = false;
    setRecordingProjectLoading(true);
    const qs = new URLSearchParams({ userId: user.id });
    if (activeBrandKitId) qs.set('brandKitId', activeBrandKitId);
    void fetch(`/api/workspaces/${encodeURIComponent(preferredWorkspaceId)}/default-project?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('default-project');
        return r.json() as Promise<{ projectId?: string }>;
      })
      .then((j) => {
        if (!cancelled) setRecordingProjectId(j.projectId ?? null);
      })
      .catch(() => {
        if (!cancelled) setRecordingProjectId(null);
      })
      .finally(() => {
        if (!cancelled) setRecordingProjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, preferredWorkspaceId, activeBrandKitId]);

  const value = useMemo<WorkspaceBrandContextValue>(
    () => ({
      workspaces: Array.isArray(workspaces) ? workspaces : null,
      workspacesLoading,
      refetchWorkspaces,
      preferredWorkspaceId,
      setPreferredWorkspaceId,
      activeBrandKitId,
      setActiveBrandKitId,
      brandKits: Array.isArray(brandKits) ? brandKits : null,
      brandKitsLoading,
      refetchBrandKits,
      recordingProjectId,
      recordingProjectLoading,
    }),
    [
      workspaces,
      workspacesLoading,
      refetchWorkspaces,
      preferredWorkspaceId,
      setPreferredWorkspaceId,
      activeBrandKitId,
      setActiveBrandKitId,
      brandKits,
      brandKitsLoading,
      refetchBrandKits,
      recordingProjectId,
      recordingProjectLoading,
    ]
  );

  return <WorkspaceBrandContext.Provider value={value}>{children}</WorkspaceBrandContext.Provider>;
}

export function useWorkspaceBrand(): WorkspaceBrandContextValue {
  const ctx = useContext(WorkspaceBrandContext);
  if (!ctx) {
    throw new Error('useWorkspaceBrand must be used within WorkspaceBrandProvider');
  }
  return ctx;
}

/** For optional use outside the main shell (should be rare). */
export function useWorkspaceBrandOptional(): WorkspaceBrandContextValue | null {
  return useContext(WorkspaceBrandContext);
}
