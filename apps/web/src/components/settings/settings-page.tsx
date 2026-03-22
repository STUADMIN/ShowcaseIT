'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { LiquidGlassSettingsSection } from '@/components/settings/liquid-glass-settings-section';
import { useAuth } from '@/lib/auth/auth-context';
import { useApi, apiPatch, apiDeleteWithBody } from '@/hooks/use-api';
import { usePreferredWorkspaceId } from '@/hooks/use-preferred-workspace-id';
import { createClient } from '@/lib/supabase/client';
import { DEV_USER } from '@/lib/auth/config';

interface WorkspaceData {
  id: string;
  name: string;
  plan: string;
}

const DELETE_CONFIRM = 'DELETE MY ACCOUNT';

export function SettingsPage() {
  const router = useRouter();
  const { user, updateLocalUser, signOut } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const wsUrl = user?.id ? `/api/workspaces?userId=${encodeURIComponent(user.id)}` : '';
  const { data: workspaces, loading: wsLoading, refetch: refetchWorkspaces } = useApi<WorkspaceData[]>({
    url: wsUrl,
  });
  const [preferredWorkspaceId, setPreferredWorkspaceId] = usePreferredWorkspaceId(workspaces);

  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState({
    guidePublished: true,
    teamInvites: true,
    weeklyDigest: false,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /** Load profile from DB (name + avatar) */
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/users/${user.id}`);
        if (!r.ok) return;
        const p = (await r.json()) as { name: string | null; avatarUrl: string | null };
        if (cancelled) return;
        setName(p.name || user.name || '');
        updateLocalUser({
          name: p.name || user.name,
          image: p.avatarUrl ?? user.image ?? null,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- sync once per user id

  useEffect(() => {
    const w = workspaces?.find((x) => x.id === preferredWorkspaceId);
    if (w) setWorkspaceName(w.name);
  }, [workspaces, preferredWorkspaceId]);

  useEffect(() => {
    if (!user?.id) {
      setNotifLoading(false);
      return;
    }
    let cancelled = false;
    setNotifLoading(true);
    setNotifError(null);

    (async () => {
      try {
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
          }),
        });
        if (cancelled) return;
        const r = await fetch(`/api/users/${user.id}/notification-settings`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setNotifications({
          guidePublished: Boolean(data.guidePublished),
          teamInvites: Boolean(data.teamInvites),
          weeklyDigest: Boolean(data.weeklyDigest),
        });
      } catch {
        if (!cancelled) setNotifError('Could not load notification preferences');
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.name]);

  const persistNotification = useCallback(
    (patch: Partial<typeof notifications>) => {
      if (!user?.id) return;
      if (notifSaveRef.current) clearTimeout(notifSaveRef.current);
      notifSaveRef.current = setTimeout(async () => {
        try {
          setNotifError(null);
          const res = await fetch(`/api/users/${user.id}/notification-settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
          setNotifError('Could not save notification preferences');
        }
      }, 250);
    },
    [user?.id]
  );

  const handleSaveWorkspace = async () => {
    if (!preferredWorkspaceId) return;
    try {
      await apiPatch(`/api/workspaces/${preferredWorkspaceId}`, { name: workspaceName });
      await refetchWorkspaces();
      setProfileMessage('Workspace updated');
      setTimeout(() => setProfileMessage(null), 2500);
    } catch {
      setProfileMessage('Could not update workspace');
      setTimeout(() => setProfileMessage(null), 3000);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const updated = await apiPatch<{ name: string | null; avatarUrl: string | null }>(
        `/api/users/${user.id}`,
        { name }
      );
      updateLocalUser({ name: updated.name || name });
      if (user.id !== DEV_USER.id) {
        const { error } = await supabase.auth.updateUser({
          data: { full_name: name, name, display_name: name },
        });
        if (error) console.warn('Supabase profile update:', error.message);
      }
      setProfileMessage('Profile saved');
      setTimeout(() => setProfileMessage(null), 2500);
    } catch {
      setProfileMessage('Could not save profile');
      setTimeout(() => setProfileMessage(null), 3000);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = (await res.json()) as { avatarUrl: string | null };
      updateLocalUser({ image: data.avatarUrl });
      setProfileMessage('Avatar updated');
      setTimeout(() => setProfileMessage(null), 2500);
    } catch {
      setProfileMessage('Could not upload avatar');
      setTimeout(() => setProfileMessage(null), 3000);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || deleteConfirmText !== DELETE_CONFIRM) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiDeleteWithBody(`/api/users/${user.id}`, { confirm: DELETE_CONFIRM });
      try {
        localStorage.removeItem('showcaseit:activeWorkspaceId');
      } catch {
        /* ignore */
      }
      await signOut();
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600';

  const activeWorkspace = workspaces?.find((w) => w.id === preferredWorkspaceId);
  const planLabel = activeWorkspace?.plan ?? '—';

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto w-full min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-gray-400 mt-1">Manage your account and preferences</p>
        </div>

        {profileMessage && (
          <p className="text-sm text-brand-400 mb-4" role="status">
            {profileMessage}
          </p>
        )}

        {/* Profile */}
        <section className="card mb-6">
          <h3 className="text-lg font-semibold mb-6">Profile</h3>
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden shrink-0">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="w-full h-full object-cover" />
              ) : (
                (name || user?.name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleAvatarChange} />
              <button
                type="button"
                disabled={!user?.id || avatarUploading}
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-sm py-2 px-4 disabled:opacity-50"
              >
                {avatarUploading ? 'Uploading…' : 'Change Avatar'}
              </button>
              <p className="text-xs text-gray-600 mt-2">PNG, JPG, or WebP up to 2MB</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Display Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Email</label>
              <input type="email" value={user?.email || ''} disabled className={`${inputClass} opacity-50`} />
              <p className="text-xs text-gray-600 mt-1">Contact support to change your email</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={profileSaving || !user?.id}
            className="btn-primary mt-6 text-sm disabled:opacity-50"
          >
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </section>

        {/* Workspace */}
        <section className="card mb-6">
          <h3 className="text-lg font-semibold mb-6">Workspace</h3>
          {wsLoading ? (
            <p className="text-sm text-gray-500">Loading workspaces…</p>
          ) : !workspaces?.length ? (
            <p className="text-sm text-gray-500">No workspaces found.</p>
          ) : (
            <div className="space-y-4">
              {workspaces.length > 1 && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">Active workspace</label>
                  <select
                    value={preferredWorkspaceId}
                    onChange={(e) => setPreferredWorkspaceId(e.target.value)}
                    className={inputClass}
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">Plan</span>
                <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-200 capitalize border border-gray-700">
                  {planLabel}
                </span>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Workspace name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={() => void handleSaveWorkspace()} className="btn-primary text-sm">
                Update Workspace
              </button>
            </div>
          )}
        </section>

        <LiquidGlassSettingsSection />

        {/* Notifications */}
        <section className="card mb-6">
          <h3 className="text-lg font-semibold mb-6">Notifications</h3>
          <p className="text-xs text-gray-600 mb-4 break-words [overflow-wrap:anywhere]">
            Preferences are stored on your account. Weekly digest emails run on a schedule in production (Mondays
            09:00 UTC when deployed to Vercel with <code className="text-gray-400 break-all">CRON_SECRET</code> and
            optional <code className="text-gray-400 break-all">RESEND_API_KEY</code> — see{' '}
            <code className="text-gray-400 break-all">apps/web/.env.example</code>
            ).
          </p>
          {notifError && <p className="text-sm text-red-400 mb-3">{notifError}</p>}
          {notifLoading ? (
            <p className="text-sm text-gray-500">Loading notification settings…</p>
          ) : (
            <div className="space-y-4">
              {(
                [
                  {
                    key: 'guidePublished' as const,
                    label: 'Guide published',
                    desc: 'When a guide is published or updated (in-app / future email)',
                  },
                  {
                    key: 'teamInvites' as const,
                    label: 'Team invitations',
                    desc: 'When someone invites you to a workspace',
                  },
                  {
                    key: 'weeklyDigest' as const,
                    label: 'Weekly digest',
                    desc: 'Email summary each week: your guide counts, recently updated guides, and (soon) views & engagement',
                  },
                ] as const
              ).map((item) => (
                <label key={item.key} className="flex items-center justify-between cursor-pointer gap-4 min-w-0">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium text-gray-200">{item.label}</p>
                    <p className="text-xs text-gray-500 break-words">{item.desc}</p>
                  </div>
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={notifications[item.key]}
                      disabled={!user?.id}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNotifications((prev) => ({ ...prev, [item.key]: checked }));
                        persistNotification({ [item.key]: checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-700 rounded-full peer-checked:bg-brand-600 transition-colors peer-disabled:opacity-40" />
                    <div className="absolute top-1 left-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="card border-red-900/30">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200">Delete Account</p>
              <p className="text-xs text-gray-500">Permanently delete your account, guides, recordings, and team memberships</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteConfirmText('');
                setDeleteError(null);
              }}
              className="shrink-0 self-start sm:self-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-600/15 text-red-400 border border-red-600/30 hover:bg-red-600/25 transition-all"
            >
              Delete Account
            </button>
          </div>
        </section>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
          <div className="card max-w-md w-full border border-red-900/40 shadow-xl">
            <h4 id="delete-account-title" className="text-lg font-semibold text-red-300 mb-2">
              Delete your account?
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              This cannot be undone. Type <strong className="text-gray-200">{DELETE_CONFIRM}</strong> below to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={DELETE_CONFIRM}
              className={inputClass + ' mb-3'}
              autoComplete="off"
            />
            {deleteError && <p className="text-sm text-red-400 mb-3">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={() => setShowDeleteModal(false)} disabled={deleteBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-40"
                disabled={deleteBusy || deleteConfirmText !== DELETE_CONFIRM}
                onClick={() => void handleDeleteAccount()}
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
