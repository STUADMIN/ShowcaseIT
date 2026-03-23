interface ConfluenceConfig {
  baseUrl: string;
  authToken: string;
}

/** Parse Confluence REST error JSON into a short, actionable message for the UI. */
export function formatConfluenceApiError(status: number, bodyText: string): string {
  try {
    const j = JSON.parse(bodyText) as {
      message?: string;
      data?: {
        errors?: Array<{ message?: string | { key?: string; message?: string } }>;
      };
    };
    const parts: string[] = [];
    const errs = j.data?.errors;
    if (Array.isArray(errs)) {
      for (const e of errs) {
        const m = e?.message;
        if (typeof m === 'string') parts.push(m);
        else if (m && typeof m === 'object' && typeof m.key === 'string') parts.push(m.key);
      }
    }
    if (parts.length) {
      let msg = parts.join(' — ');
      if (parts.some((p) => /space does not exist/i.test(p))) {
        msg +=
          '. Use the **space key** (in the browser URL: …/wiki/spaces/**KEY**/overview), not the space title. In ShowcaseIt → Confluence setup, paste that URL into Space Key or type KEY only. Re-save Connect, then publish again.';
      }
      return `Confluence API error (${status}): ${msg}`;
    }
    if (typeof j.message === 'string' && j.message.trim()) {
      return `Confluence API error (${status}): ${j.message.trim()}`;
    }
  } catch {
    /* not JSON */
  }
  return `Confluence API error (${status}): ${bodyText}`;
}

interface CreatePageOptions {
  spaceKey: string;
  title: string;
  htmlContent: string;
  parentPageId?: string;
  labels?: string[];
}

interface UpdatePageOptions {
  pageId: string;
  title: string;
  htmlContent: string;
  version: number;
  labels?: string[];
}

interface ConfluencePage {
  id: string;
  title: string;
  version: { number: number };
  _links: { webui: string; self: string };
}

/**
 * Client for the Confluence Cloud REST API v2.
 *
 * Converts ShowcaseIt guide HTML into Confluence storage format and
 * creates/updates pages in a specified space.
 */
export class ConfluenceClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ConfluenceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      Authorization: `Basic ${config.authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Space **title** (what you see in the sidebar) and **key** (in the URL `/spaces/KEY/`) are often different.
   * Accepts either key or title and returns the key Confluence expects for REST calls.
   */
  async resolveSpaceKey(candidate: string): Promise<string> {
    const raw = candidate.trim();
    if (!raw) {
      throw new Error('Space key is empty.');
    }
    const collapsed = raw.replace(/\s+/g, '');
    const upper = collapsed.toUpperCase();

    const tryGetByKey = async (key: string): Promise<string | null> => {
      const enc = encodeURIComponent(key);
      const res = await fetch(`${this.baseUrl}/wiki/rest/api/space/${enc}`, {
        headers: this.headers,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { key?: string };
      return (data.key || key).trim();
    };

    let resolved = await tryGetByKey(collapsed);
    if (resolved) return resolved;
    resolved = await tryGetByKey(upper);
    if (resolved) return resolved;
    resolved = await tryGetByKey(raw);
    if (resolved) return resolved;

    const nameNeedle = raw.toLowerCase();
    const nameCollapsed = nameNeedle.replace(/\s+/g, '');
    const limit = 100;
    let start = 0;
    /** Keys starting with ~ are personal spaces; team/site spaces are easier to publish into. */
    const teamSamples: string[] = [];
    const personalSamples: string[] = [];

    for (let i = 0; i < 30; i++) {
      const res = await fetch(
        `${this.baseUrl}/wiki/rest/api/space?limit=${limit}&start=${start}`,
        { headers: this.headers }
      );
      if (!res.ok) {
        break;
      }
      const data = (await res.json()) as {
        results?: Array<{ key: string; name: string }>;
      };
      const results = data.results ?? [];
      for (const s of results) {
        const k = s.key.trim();
        const label = `${k} (“${s.name}”)`;
        if (k.startsWith('~')) {
          if (personalSamples.length < 8) personalSamples.push(label);
        } else if (teamSamples.length < 15) {
          teamSamples.push(label);
        }
        if (k.toUpperCase() === upper) return k;
        const nm = s.name.trim().toLowerCase();
        if (nm === nameNeedle || nm.replace(/\s+/g, '') === nameCollapsed) return k;
      }
      if (results.length < limit) break;
      start += limit;
    }

    const teamLine =
      teamSamples.length > 0
        ? `Team / site spaces this API user can see (use one of these keys if appropriate): ${teamSamples.join('; ')}. `
        : '';
    const personalLine =
      personalSamples.length > 0
        ? `Personal spaces (~… keys) for this user: ${personalSamples.join('; ')}. `
        : '';
    const listHint = teamLine + personalLine;

    throw new Error(
      `Confluence: no space matches “${raw}” for the Atlassian account used by your API token. ` +
        `If you see the space in the browser but it is not listed below, that user is usually not a member of the space (Confluence often hides it from the API as “does not exist”). ` +
        `Fix — (1) Log into Confluence as the same email as the API token and open the space; copy …/wiki/spaces/KEY/… ` +
        `(2) Space settings → Permissions: add that user, or create the API token from someone who already has access. ` +
        `(3) Put KEY in ShowcaseIt → Confluence space key. ` +
        `${listHint || 'Could not list spaces — verify Site URL and token.'}`
    );
  }

  async createPage(options: CreatePageOptions): Promise<ConfluencePage> {
    const storageContent = this.convertToStorageFormat(options.htmlContent);

    const body: Record<string, unknown> = {
      type: 'page',
      title: options.title,
      space: { key: options.spaceKey },
      body: {
        storage: {
          value: storageContent,
          representation: 'storage',
        },
      },
    };

    if (options.parentPageId) {
      body.ancestors = [{ id: options.parentPageId }];
    }

    const response = await fetch(`${this.baseUrl}/wiki/rest/api/content`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence API error (${response.status}): ${error}`);
    }

    const page = (await response.json()) as ConfluencePage;

    if (options.labels?.length) {
      await this.addLabels(page.id, options.labels);
    }

    return page;
  }

  async updatePage(options: UpdatePageOptions): Promise<ConfluencePage> {
    const storageContent = this.convertToStorageFormat(options.htmlContent);

    const body = {
      type: 'page',
      title: options.title,
      version: { number: options.version + 1 },
      body: {
        storage: {
          value: storageContent,
          representation: 'storage',
        },
      },
    };

    const response = await fetch(
      `${this.baseUrl}/wiki/rest/api/content/${options.pageId}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(formatConfluenceApiError(response.status, error));
    }

    const page = (await response.json()) as ConfluencePage;

    if (options.labels?.length) {
      await this.addLabels(page.id, options.labels);
    }

    return page;
  }

  /**
   * Find an existing page by exact title in a space (Confluence Cloud REST v1).
   */
  async findPageByTitle(
    spaceKey: string,
    title: string
  ): Promise<{ id: string; version: number } | null> {
    const q = new URLSearchParams({
      spaceKey,
      title,
      type: 'page',
    });
    const response = await fetch(`${this.baseUrl}/wiki/rest/api/content?${q.toString()}`, {
      headers: this.headers,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      results: Array<{ id: string; version: { number: number } }>;
    };
    const first = data.results?.[0];
    if (!first?.id) return null;
    return { id: first.id, version: first.version?.number ?? 1 };
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const response = await fetch(
      `${this.baseUrl}/wiki/rest/api/content/${pageId}?expand=version`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page ${pageId}: ${response.status}`);
    }

    return (await response.json()) as ConfluencePage;
  }

  async getSpaces(): Promise<Array<{ key: string; name: string }>> {
    const response = await fetch(
      `${this.baseUrl}/wiki/rest/api/space?limit=50`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch spaces: ${response.status}`);
    }

    const data = (await response.json()) as { results: Array<{ key: string; name: string }> };
    return data.results;
  }

  async addLabels(pageId: string, labels: string[]): Promise<void> {
    const body = labels.map((name) => ({ prefix: 'global', name }));

    await fetch(
      `${this.baseUrl}/wiki/rest/api/content/${pageId}/label`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      }
    );
  }

  async uploadAttachment(pageId: string, fileName: string, fileBuffer: Uint8Array, contentType: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer as BlobPart], { type: contentType });
    formData.append('file', blob, fileName);

    const response = await fetch(
      `${this.baseUrl}/wiki/rest/api/content/${pageId}/child/attachment`,
      {
        method: 'POST',
        headers: {
          Authorization: this.headers.Authorization,
          'X-Atlassian-Token': 'nocheck',
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload attachment: ${response.status}`);
    }

    const data = (await response.json()) as { results: Array<{ _links: { download: string } }> };
    return `${this.baseUrl}/wiki${data.results[0]._links.download}`;
  }

  /**
   * Converts ShowcaseIt HTML output to Confluence storage format.
   * Strips unsupported elements, converts styles to Confluence-compatible markup,
   * and wraps complex HTML in the HTML macro when needed.
   */
  private convertToStorageFormat(html: string): string {
    let content = html;

    content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<link[^>]*>/gi, '');
    content = content.replace(/<!DOCTYPE[^>]*>/gi, '');
    content = content.replace(/<\/?html[^>]*>/gi, '');
    content = content.replace(/<\/?head[^>]*>/gi, '');
    content = content.replace(/<\/?body[^>]*>/gi, '');
    content = content.replace(/<meta[^>]*>/gi, '');

    content = content.trim();

    if (this.hasComplexHtml(content)) {
      return `<ac:structured-macro ac:name="html">
        <ac:plain-text-body><![CDATA[${html}]]></ac:plain-text-body>
      </ac:structured-macro>`;
    }

    return content;
  }

  private hasComplexHtml(content: string): boolean {
    const complexPatterns = [
      /backdrop-filter/i,
      /css\s*variable/i,
      /var\(--/i,
      /@keyframes/i,
      /animation:/i,
    ];
    return complexPatterns.some((p) => p.test(content));
  }
}

export function createConfluenceAuthToken(email: string, apiToken: string): string {
  const raw = `${email}:${apiToken}`;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(raw, 'utf8').toString('base64');
  }
  if (typeof btoa !== 'undefined') {
    return btoa(raw);
  }
  throw new Error('No base64 encoder available');
}
