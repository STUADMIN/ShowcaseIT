'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { LiquidGlassSettingsSection } from '@/components/settings/liquid-glass-settings-section';
import { useAuth } from '@/lib/auth/auth-context';
import { useApi, apiPatch } from '@/hooks/use-api';

interface WorkspaceData {
  id: string;
  name: string;
  plan: string;
}

export function SettingsPage() {
  const { user } = useAuth();
  const { data: workspaces } = useApi<WorkspaceData[]>({ url: '/api/workspaces' });
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [notifications, setNotifications] = useState({
    guidePublished: true,
    teamInvites: true,
    weeklyDigest: false,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setNotifLoading(false);
      return;
    }
    let cancelled = false;
    setNotifLoading(true);
    setNotifError(null);
    fetch(`/api/users/${user.id}/notification-settings`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setNotifications({
          guidePublished: Boolean(data.guidePublished),
          teamInvites: Boolean(data.teamInvites),
          weeklyDigest: Boolean(data.weeklyDigest),
        });
      })
      .catch(() => {
        if (!cancelled) setNotifError('Could not load notification preferences');
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  useEffect(() => {
    if (workspaces?.length) {
      setWorkspaceName(workspaces[0].name);
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces]);

  const handleSaveWorkspace = async () => {
    if (!workspaceId) return;
    try {
      await apiPatch(`/api/workspaces/${workspaceId}`, { name: workspaceName });
    } catch {}
  };

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600';

  return (
    <AppShell>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Settings</h2>
            <p className="text-gray-400 mt-1">Manage your account and preferences</p>
          </div>

          {/* Profile */}
          <section className="card mb-6">
            <h3 className="text-lg font-semibold mb-6">Profile</h3>
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center text-2xl font-bold text-white">
                {(name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <button className="btn-secondary text-sm py-2 px-4">Change Avatar</button>
                <p className="text-xs text-gray-600 mt-2">JPG or PNG, max 2MB</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Email</label>
                <input type="email" value={user?.email || ''} disabled className={`${inputClass} opacity-50`} />
                <p className="text-xs text-gray-600 mt-1">Contact support to change your email</p>
              </div>
            </div>
            <button className="btn-primary mt-6 text-sm">Save Profile</button>
          </section>

          {/* Workspace */}
          <section className="card mb-6">
            <h3 className="text-lg font-semibold mb-6">Workspace</h3>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className={inputClass}
              />
            </div>
            <button onClick={handleSaveWorkspace} className="btn-primary mt-6 text-sm">Update Workspace</button>
          </section>

          <LiquidGlassSettingsSection />

          {/* Notifications */}
          <section className="card mb-6">
            <h3 className="text-lg font-semibold mb-6">Notifications</h3>
            <p className="text-xs text-gray-600 mb-4">
              Preferences are stored on your account. Weekly digest emails run on a schedule in production (Mondays
              09:00 UTC when deployed to Vercel with <code className="text-gray-400">CRON_SECRET</code> and optional{' '}
              <code className="text-gray-400">RESEND_API_KEY</code> — see <code className="text-gray-400">apps/web/.env.example</code>
              ).
            </p>
            {notifError && <p className="text-sm text-red-400 mb-3">{notifError}</p>}
            {notifLoading ? (
              <p className="text-sm text-gray-500">Loading notification settings…</p>
            ) : (
            <div className="space-y-4">
              {([
                { key: 'guidePublished' as const, label: 'Guide published', desc: 'When a guide is published or updated (in-app / future email)' },
                { key: 'teamInvites' as const, label: 'Team invitations', desc: 'When someone invites you to a workspace' },
                {
                  key: 'weeklyDigest' as const,
                  label: 'Weekly digest',
                  desc: 'Email summary each week: your guide counts, recently updated guides, and (soon) views & engagement',
                },
              ]).map((item) => (
                <label key={item.key} className="flex items-center justify-between cursor-pointer gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Delete Account</p>
                <p className="text-xs text-gray-500">Permanently delete your account and all data</p>
              </div>
              <button className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/15 text-red-400 border border-red-600/30 hover:bg-red-600/25 transition-all">
                Delete Account
              </button>
            </div>
          </section>
        </div>
    </AppShell>
  );
}
