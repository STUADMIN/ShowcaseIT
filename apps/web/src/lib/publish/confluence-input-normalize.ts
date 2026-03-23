/**
 * Normalize common user mistakes when pasting Confluence Cloud links into Connect fields.
 */

/** Site root only, e.g. https://your-site.atlassian.net (no /wiki/... paths). */
export function normalizeConfluenceBaseUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    const u = s.includes('://') ? new URL(s) : new URL(`https://${s}`);
    // Atlassian Cloud: always use origin (drops /wiki/spaces/... paste mistakes)
    if (u.hostname.endsWith('.atlassian.net')) {
      return `${u.protocol}//${u.hostname}`;
    }
    // Server / Data Center: origin only (no path) for our REST client which adds /wiki/rest/...
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return s;
  }
}

/**
 * If the user pastes a space home/overview URL, extract the key from the path.
 * Examples: .../wiki/spaces/TEAM/overview, .../spaces/TEAM/home
 */
export function extractConfluenceSpaceKeyFromUrlOrPath(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    const u = s.includes('://') ? new URL(s) : new URL(`https://${s}`);
    const m = u.pathname.match(/\/(?:wiki\/)?spaces\/([^/?#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]).trim();
  } catch {
    /* not a URL */
  }
  return '';
}

/**
 * Space keys are short identifiers (e.g. XERT, DOCS) — not the space display name.
 * Accepts pasted Confluence URLs and extracts the key from /spaces/KEY/...
 */
export function normalizeConfluenceSpaceKey(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const fromUrl = extractConfluenceSpaceKeyFromUrlOrPath(s);
  const core = fromUrl || s;
  return core.toUpperCase().replace(/\s+/g, '');
}

/**
 * Parent page: numeric ID only. Accepts pasted URLs and extracts the page id when possible.
 * e.g. .../pages/77604454/... or .../edit-v2/77604454
 */
export function extractConfluenceParentPageId(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return s;
  try {
    const u = s.includes('://') ? new URL(s) : null;
    if (u) {
      const path = u.pathname;
      // .../pages/123456789/title or .../viewpage.action?pageId=123
      const pageIdParam = u.searchParams.get('pageId');
      if (pageIdParam && /^\d+$/.test(pageIdParam)) return pageIdParam;
      const parts = path.split('/').filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        if (/^\d{5,}$/.test(p)) return p;
      }
    }
  } catch {
    /* fall through */
  }
  // Last resort: first long digit run in the string
  const m = s.match(/\d{5,}/);
  return m ? m[0] : '';
}

export type NormalizedConfluenceForm = {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string;
};

export function normalizeConfluenceConnectForm(input: {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string;
}): NormalizedConfluenceForm {
  return {
    baseUrl: normalizeConfluenceBaseUrl(input.baseUrl),
    email: input.email.trim(),
    apiToken: input.apiToken.trim(),
    spaceKey: normalizeConfluenceSpaceKey(input.spaceKey),
    parentPageId: extractConfluenceParentPageId(input.parentPageId),
  };
}
