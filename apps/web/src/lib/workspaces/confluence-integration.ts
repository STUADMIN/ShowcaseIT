/**
 * Shape stored in `workspaces.confluence_integration` (JSONB / Prisma Json).
 * Persists in your Supabase-hosted Postgres when DATABASE_URL uses that project.
 */

export type ConfluenceIntegrationDto = {
  connected: boolean;
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string;
};

export const emptyConfluenceIntegration = (): ConfluenceIntegrationDto => ({
  connected: false,
  baseUrl: '',
  email: '',
  apiToken: '',
  spaceKey: '',
  parentPageId: '',
});

export function parseConfluenceIntegration(raw: unknown): ConfluenceIntegrationDto {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyConfluenceIntegration();
  }
  const o = raw as Record<string, unknown>;
  return {
    connected: Boolean(o.connected),
    baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl : '',
    email: typeof o.email === 'string' ? o.email : '',
    apiToken: typeof o.apiToken === 'string' ? o.apiToken : '',
    spaceKey: typeof o.spaceKey === 'string' ? o.spaceKey : '',
    parentPageId: typeof o.parentPageId === 'string' ? o.parentPageId : '',
  };
}

export function isConfluenceIntegrationEmpty(d: ConfluenceIntegrationDto): boolean {
  return (
    !d.connected &&
    !d.baseUrl.trim() &&
    !d.email.trim() &&
    !d.apiToken.trim() &&
    !d.spaceKey.trim() &&
    !d.parentPageId.trim()
  );
}
