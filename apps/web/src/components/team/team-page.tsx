'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/use-api';

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

interface WorkspaceData {
  id: string;
  name: string;
  plan: string;
  members: TeamMember[];
  _count: { projects: number; members: number };
}

const roles = ['owner', 'admin', 'editor', 'viewer'] as const;

const roleDescriptions: Record<string, string> = {
  owner: 'Full access, billing, and team management',
  admin: 'Manage team members and all guides',
  editor: 'Create and edit guides',
  viewer: 'View guides only',
};

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-purple-600/15 text-purple-400 border-purple-600/30',
  admin: 'bg-blue-600/15 text-blue-400 border-blue-600/30',
  editor: 'bg-green-600/15 text-green-400 border-green-600/30',
  viewer: 'bg-gray-600/15 text-gray-400 border-gray-600/30',
};

export function TeamPage() {
  const { data: workspaces, loading: wsLoading } = useApi<WorkspaceData[]>({ url: '/api/workspaces' });
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');

  useEffect(() => {
    if (workspaces?.length) {
      fetch(`/api/workspaces/${workspaces[0].id}`)
        .then((r) => r.json())
        .then(setWorkspace)
        .catch(() => {});
    }
  }, [workspaces]);

  const handleInvite = async () => {
    if (!inviteEmail || !workspace) return;
    try {
      await apiPost(`/api/workspaces/${workspace.id}/members`, { email: inviteEmail, role: inviteRole });
      const updated = await fetch(`/api/workspaces/${workspace.id}`).then((r) => r.json());
      setWorkspace(updated);
      setInviteEmail('');
      setShowInvite(false);
    } catch {}
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!workspace) return;
    try {
      await apiDelete(`/api/workspaces/${workspace.id}/members/${memberId}`);
      setWorkspace((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : null);
    } catch {}
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!workspace) return;
    try {
      await apiPatch(`/api/workspaces/${workspace.id}/members/${memberId}`, { role: newRole });
      setWorkspace((prev) => prev ? {
        ...prev,
        members: prev.members.map((m) => m.id === memberId ? { ...m, role: newRole } : m),
      } : null);
    } catch {}
  };

  const members = workspace?.members ?? [];

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600';

  return (
    <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Team</h2>
              <p className="text-gray-400 mt-1">Manage your workspace and team members</p>
            </div>
            <button onClick={() => setShowInvite(true)} className="btn-primary">
              + Invite Member
            </button>
          </div>

          {wsLoading || !workspace ? (
            <div className="card p-16 text-center"><p className="text-gray-500">Loading workspace...</p></div>
          ) : (
            <>
              {/* Workspace info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="card">
                  <p className="text-sm text-gray-400">Workspace</p>
                  <p className="text-xl font-bold mt-1">{workspace.name}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-400">Members</p>
                  <p className="text-xl font-bold mt-1">{members.length}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-400">Plan</p>
                  <p className="text-xl font-bold mt-1 capitalize">{workspace.plan}</p>
                </div>
              </div>

              {/* Team members */}
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Members
              </h3>
              <div className="card divide-y divide-gray-800">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                        {(member.user.name || member.user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{member.user.name || member.user.email.split('@')[0]}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">{new Date(member.joinedAt).toLocaleDateString()}</span>
                      {member.role === 'owner' ? (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${roleBadgeColors[member.role]}`}>
                          Owner
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none"
                        >
                          {roles.filter((r) => r !== 'owner').map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      )}
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                          title="Remove member"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Role descriptions */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Roles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((role) => (
                <div key={role} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadgeColors[role]}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500">{roleDescriptions[role]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invite modal */}
          {showInvite && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="card w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Invite Team Member</h3>
                  <button
                    onClick={() => setShowInvite(false)}
                    className="text-gray-500 hover:text-gray-300 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                      className={inputClass}
                    >
                      <option value="admin">Admin — {roleDescriptions.admin}</option>
                      <option value="editor">Editor — {roleDescriptions.editor}</option>
                      <option value="viewer">Viewer — {roleDescriptions.viewer}</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowInvite(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail}
                    className="btn-primary flex-1 disabled:opacity-40"
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}
