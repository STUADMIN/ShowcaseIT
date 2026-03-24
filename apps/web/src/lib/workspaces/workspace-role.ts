export const WORKSPACE_MEMBER_ROLES = ['admin', 'member'] as const;
export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number];

/** Legacy DB values that count as workspace admin. */
const ADMIN_EQUIVALENT = new Set(['admin', 'owner']);

export function isWorkspaceAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_EQUIVALENT.has(role);
}

/**
 * Normalize API/UI input and migrate legacy roles: owner/admin → admin, editor/viewer → member.
 */
export function normalizeWorkspaceMemberRole(input: unknown): WorkspaceMemberRole {
  const s = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (s === 'admin' || s === 'owner') return 'admin';
  if (s === 'member' || s === 'editor' || s === 'viewer') return 'member';
  return 'member';
}
