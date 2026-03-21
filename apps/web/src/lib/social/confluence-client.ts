interface ConfluenceConfig {
  baseUrl: string;
  authToken: string;
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
      throw new Error(`Confluence API error (${response.status}): ${error}`);
    }

    const page = (await response.json()) as ConfluencePage;

    if (options.labels?.length) {
      await this.addLabels(page.id, options.labels);
    }

    return page;
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
  return btoa(`${email}:${apiToken}`);
}
