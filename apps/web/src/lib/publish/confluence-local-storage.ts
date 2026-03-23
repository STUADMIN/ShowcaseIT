/**
 * **Read-only legacy:** Confluence settings now live in Postgres (`workspaces.confluence_integration`).
 * We only **read** old keys once so the Publish page can migrate them to the API, then `clearConfluenceState` runs.
 * Do not add new writes — use `PATCH /api/workspaces/[id]/integrations/confluence` only.
 */

export interface ConfluenceSettingsPersisted {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string;
}

export interface ConfluenceStoredState extends ConfluenceSettingsPersisted {
  connected: boolean;
}

const key = (workspaceId: string) => `showcaseit:confluence:v1:${workspaceId}`;

export function loadConfluenceState(workspaceId: string): ConfluenceStoredState | null {
  if (!workspaceId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(workspaceId));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<ConfluenceStoredState>;
    if (!o || typeof o !== 'object') return null;
    return {
      connected: Boolean(o.connected),
      baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl : '',
      email: typeof o.email === 'string' ? o.email : '',
      apiToken: typeof o.apiToken === 'string' ? o.apiToken : '',
      spaceKey: typeof o.spaceKey === 'string' ? o.spaceKey : '',
      parentPageId: typeof o.parentPageId === 'string' ? o.parentPageId : '',
    };
  } catch {
    return null;
  }
}

export function clearConfluenceState(workspaceId: string): void {
  if (!workspaceId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key(workspaceId));
  } catch {
    /* ignore */
  }
}
