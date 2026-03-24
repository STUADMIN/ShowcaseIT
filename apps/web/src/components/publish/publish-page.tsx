'use client';

import { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Facebook,
  FileStack,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi, apiPatch, apiPost } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth/auth-context';
import { useWorkspaceBrand } from '@/components/layout/workspace-brand-context';
import { loadConfluenceState, clearConfluenceState } from '@/lib/publish/confluence-local-storage';
import type { ConfluenceIntegrationDto } from '@/lib/workspaces/confluence-integration';
import { isConfluenceIntegrationEmpty } from '@/lib/workspaces/confluence-integration';
import {
  normalizeConfluenceConnectForm,
  normalizeConfluenceSpaceKey,
} from '@/lib/publish/confluence-input-normalize';

interface Platform {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  category: 'social' | 'documentation';
}

const platforms: Platform[] = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, description: 'Upload video guides and tutorials', category: 'social' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, description: 'Share professional guides and posts', category: 'social' },
  { id: 'x', name: 'X (Twitter)', icon: Twitter, description: 'Post guide threads and videos', category: 'social' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, description: 'Share to pages and groups', category: 'social' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, description: 'Share visual guide carousels', category: 'social' },
  { id: 'confluence', name: 'Confluence', icon: FileStack, description: 'Publish guides as Confluence pages with full formatting', category: 'documentation' },
];

const socialPlatforms = platforms.filter((p) => p.category === 'social');
const docPlatforms = platforms.filter((p) => p.category === 'documentation');

interface ConfluenceSettings {
  baseUrl: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId: string;
}

export function PublishPage() {
  const { user, loading: authLoading } = useAuth();
  const { preferredWorkspaceId } = useWorkspaceBrand();

  const confluenceUrl =
    user?.id && preferredWorkspaceId
      ? `/api/workspaces/${preferredWorkspaceId}/integrations/confluence?userId=${encodeURIComponent(user.id)}`
      : '';

  const {
    data: confluenceRemote,
    loading: confluenceLoading,
    refetch: refetchConfluence,
  } = useApi<ConfluenceIntegrationDto>({ url: confluenceUrl });

  /**
   * Lists guides the signed-in user may access (auth + same visibility rules as Recordings).
   * Confluence publish still validates access server-side.
   */
  const guidesUrl = '/api/guides';
  const {
    data: guides,
    loading: guidesLoading,
    error: guidesError,
  } = useApi<Array<{ id: string; title: string; _count: { steps: number } }>>({
    url: guidesUrl,
  });
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [showConfluenceSetup, setShowConfluenceSetup] = useState(false);
  /** `edit` = already connected, updating URL/token/space key without disconnecting first */
  const [confluenceModalMode, setConfluenceModalMode] = useState<'connect' | 'edit'>('connect');
  const [confluenceSettings, setConfluenceSettings] = useState<ConfluenceSettings>({
    baseUrl: '',
    email: '',
    apiToken: '',
    spaceKey: '',
    parentPageId: '',
  });
  const [publishing, setPublishing] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishTargets, setPublishTargets] = useState<Record<string, boolean>>({});
  const [cfApplyBrand, setCfApplyBrand] = useState(true);
  const [cfUpdateIfMatch, setCfUpdateIfMatch] = useState(false);
  const [cfLabels, setCfLabels] = useState('');
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [confluenceSaveError, setConfluenceSaveError] = useState<string | null>(null);
  const confluenceMigrateAttempted = useRef<Set<string>>(new Set());
  const prevPreferredWorkspaceId = useRef(preferredWorkspaceId);

  /** Avoid showing another workspace’s Confluence row while the new workspace’s GET is in flight */
  useEffect(() => {
    if (prevPreferredWorkspaceId.current === preferredWorkspaceId) return;
    prevPreferredWorkspaceId.current = preferredWorkspaceId;
    setConfluenceSettings({
      baseUrl: '',
      email: '',
      apiToken: '',
      spaceKey: '',
      parentPageId: '',
    });
    setConnectedPlatforms((prev) => {
      const next = new Set(prev);
      next.delete('confluence');
      return next;
    });
  }, [preferredWorkspaceId]);

  /** Sync form + connected state from API; one-time migrate browser localStorage → DB */
  useEffect(() => {
    if (!preferredWorkspaceId || !user?.id) {
      setConfluenceSettings({
        baseUrl: '',
        email: '',
        apiToken: '',
        spaceKey: '',
        parentPageId: '',
      });
      setConnectedPlatforms((prev) => {
        const next = new Set(prev);
        next.delete('confluence');
        return next;
      });
      return;
    }
    if (confluenceLoading || !confluenceRemote) return;

    setConfluenceSettings({
      baseUrl: confluenceRemote.baseUrl,
      email: confluenceRemote.email,
      apiToken: confluenceRemote.apiToken,
      spaceKey: confluenceRemote.spaceKey,
      parentPageId: confluenceRemote.parentPageId,
    });
    setConnectedPlatforms((prev) => {
      const next = new Set(prev);
      if (confluenceRemote.connected) next.add('confluence');
      else next.delete('confluence');
      return next;
    });

    const wsId = preferredWorkspaceId;
    if (
      !confluenceMigrateAttempted.current.has(wsId) &&
      isConfluenceIntegrationEmpty(confluenceRemote)
    ) {
      const local = loadConfluenceState(wsId);
      const hasLocal =
        local &&
        (local.connected ||
          local.baseUrl.trim() ||
          local.apiToken.trim() ||
          local.email.trim() ||
          local.spaceKey.trim());
      if (hasLocal && local) {
        confluenceMigrateAttempted.current.add(wsId);
        void (async () => {
          try {
            await apiPatch(`/api/workspaces/${wsId}/integrations/confluence`, {
              userId: user.id,
              connected: local.connected,
              baseUrl: local.baseUrl,
              email: local.email,
              apiToken: local.apiToken,
              spaceKey: local.spaceKey,
              parentPageId: local.parentPageId,
            });
            clearConfluenceState(wsId);
            await refetchConfluence();
          } catch {
            confluenceMigrateAttempted.current.delete(wsId);
          }
        })();
      }
    }
  }, [preferredWorkspaceId, user?.id, confluenceRemote, confluenceLoading, refetchConfluence]);

  const connectedIdsKey = [...connectedPlatforms].sort().join(',');

  useEffect(() => {
    const ids = connectedIdsKey ? connectedIdsKey.split(',') : [];
    setPublishTargets((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (next[id] === undefined) next[id] = true;
      }
      for (const k of Object.keys(next)) {
        if (!ids.includes(k)) delete next[k];
      }
      return next;
    });
  }, [connectedIdsKey]);

  useEffect(() => {
    if (!selectedGuideId || !guides?.length) return;
    const g = guides.find((x) => x.id === selectedGuideId);
    if (g) setPublishTitle(g.title);
  }, [selectedGuideId, guides]);

  /** Drop selection if guide list changes (e.g. workspace switch) and old id is gone */
  useEffect(() => {
    if (!selectedGuideId || !guides) return;
    if (!guides.some((g) => g.id === selectedGuideId)) {
      setSelectedGuideId('');
    }
  }, [guides, selectedGuideId]);

  const disconnectConfluence = async () => {
    setConfluenceSaveError(null);
    if (!connectedPlatforms.has('confluence')) return;
    setConnectedPlatforms((prev) => {
      const next = new Set(prev);
      next.delete('confluence');
      return next;
    });
    if (preferredWorkspaceId && user?.id) {
      try {
        await apiPatch(`/api/workspaces/${preferredWorkspaceId}/integrations/confluence`, {
          userId: user.id,
          connected: false,
          ...confluenceSettings,
        });
        await refetchConfluence();
      } catch (e) {
        setConfluenceSaveError(e instanceof Error ? e.message : 'Could not disconnect Confluence');
        setConnectedPlatforms((prev) => new Set([...prev, 'confluence']));
      }
    }
  };

  const toggleConnect = async (platformId: string) => {
    setConfluenceSaveError(null);
    if (platformId === 'confluence') {
      if (!connectedPlatforms.has('confluence')) {
        setConfluenceModalMode('connect');
        setShowConfluenceSetup(true);
      }
      return;
    }

    setConnectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  const handleConfluenceConnect = async () => {
    setConfluenceSaveError(null);
    if (!confluenceSettings.baseUrl || !confluenceSettings.email || !confluenceSettings.apiToken || !confluenceSettings.spaceKey) {
      return;
    }
    const normalized = normalizeConfluenceConnectForm(confluenceSettings);
    setConfluenceSettings((prev) => ({ ...prev, ...normalized }));

    try {
      new URL(normalized.baseUrl);
    } catch {
      setConfluenceSaveError(
        'Confluence URL must be your site root, e.g. https://yoursite.atlassian.net — not a link to a specific page.'
      );
      return;
    }
    if (!normalized.spaceKey) {
      setConfluenceSaveError(
        'Confluence space key is required. Use the KEY from your Confluence space URL (not ShowcaseIt or company names).'
      );
      return;
    }

    if (!preferredWorkspaceId || !user?.id) {
      setConnectedPlatforms((prev) => new Set([...prev, 'confluence']));
      setShowConfluenceSetup(false);
      return;
    }
    try {
      await apiPatch(`/api/workspaces/${preferredWorkspaceId}/integrations/confluence`, {
        userId: user.id,
        connected: true,
        ...normalized,
      });
      setConnectedPlatforms((prev) => new Set([...prev, 'confluence']));
      setShowConfluenceSetup(false);
      await refetchConfluence();
    } catch (e) {
      setConfluenceSaveError(e instanceof Error ? e.message : 'Could not save Confluence settings');
    }
  };

  const handlePublish = async () => {
    setPublishResult(null);
    if (!selectedGuideId) {
      setPublishResult({ ok: false, message: 'Choose a guide to publish.' });
      return;
    }
    if (!preferredWorkspaceId || !user?.id) {
      setPublishResult({ ok: false, message: 'Sign in and select a workspace first.' });
      return;
    }

    const selectedOthers = [...connectedPlatforms].filter(
      (id) => id !== 'confluence' && publishTargets[id]
    );
    if (selectedOthers.length > 0) {
      setPublishResult({
        ok: false,
        message: `Publishing to ${selectedOthers.join(', ')} is not available yet. Uncheck those targets or use Confluence only.`,
      });
      return;
    }

    if (!connectedPlatforms.has('confluence') || !publishTargets['confluence']) {
      setPublishResult({
        ok: false,
        message: 'Turn on Confluence under “Publish To”, or connect Confluence above.',
      });
      return;
    }

    setPublishing(true);
    try {
      const res = await apiPost<{
        ok: boolean;
        pageId: string;
        url: string | null;
        updated: boolean;
        title: string;
      }>(`/api/workspaces/${preferredWorkspaceId}/integrations/confluence/publish`, {
        userId: user.id,
        guideId: selectedGuideId,
        pageTitle: publishTitle.trim() || undefined,
        pageDescription: publishDescription,
        labels: cfLabels,
        updateIfTitleMatches: cfUpdateIfMatch,
        applyBrandStyling: cfApplyBrand,
        scope: 'exportable',
      });
      setPublishResult({
        ok: true,
        message: res.updated
          ? `Updated Confluence page “${res.title}”.`
          : `Created Confluence page “${res.title}”.`,
        url: res.url ?? undefined,
      });
    } catch (e) {
      setPublishResult({
        ok: false,
        message: e instanceof Error ? e.message : 'Publish failed.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600';

  return (
    <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Publish</h2>
            <p className="text-gray-400 mt-1">
              Share your guides across social media and documentation platforms
            </p>
          </div>

          {/* Documentation Platforms */}
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Documentation Platforms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {docPlatforms.map((platform) => {
              const isConnected = connectedPlatforms.has(platform.id);
              const isConfluence = platform.id === 'confluence';
              return (
                <div
                  key={platform.id}
                  className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <IconTile icon={platform.icon} size="md" variant="brand" />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-200">{platform.name}</h4>
                      <p className="text-xs text-gray-500">{platform.description}</p>
                    </div>
                  </div>
                  {isConfluence && isConnected ? (
                    <div className="flex flex-wrap items-center gap-2 justify-end shrink-0">
                      <span className="px-3 py-2 rounded-lg text-sm font-medium bg-green-600/15 text-green-400 border border-green-600/30">
                        Connected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfluenceSaveError(null);
                          setConfluenceModalMode('edit');
                          setShowConfluenceSetup(true);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600/40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void disconnectConfluence()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:text-red-300 hover:bg-red-950/25 border border-gray-600/40"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void toggleConnect(platform.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                        isConnected
                          ? 'bg-green-600/15 text-green-400 border border-green-600/30'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                      }`}
                    >
                      {isConnected ? 'Connected' : 'Connect'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Social Platforms */}
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Social Media
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {socialPlatforms.map((platform) => {
              const isConnected = connectedPlatforms.has(platform.id);
              return (
                <div key={platform.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <IconTile icon={platform.icon} size="md" variant="brand" />
                    <div>
                      <h4 className="font-semibold text-gray-200">{platform.name}</h4>
                      <p className="text-xs text-gray-500">{platform.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleConnect(platform.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isConnected
                        ? 'bg-green-600/15 text-green-400 border border-green-600/30'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    {isConnected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Confluence Setup Modal */}
          {showConfluenceSetup && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="card w-full max-w-lg mx-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <IconTile icon={FileStack} size="md" variant="brand" />
                    <h3 className="text-lg font-semibold">
                      {confluenceModalMode === 'edit' ? 'Edit Confluence' : 'Connect Confluence'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowConfluenceSetup(false)}
                    className="text-gray-500 hover:text-gray-300 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {(!preferredWorkspaceId || !user?.id) && (
                    <p className="text-xs text-amber-200/90 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
                      Sign in and select a workspace (Settings → Team) so Confluence settings are saved to your
                      database (e.g. Supabase Postgres) for this team.
                    </p>
                  )}
                  {confluenceSaveError && (
                    <p className="text-xs text-red-200/95 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                      {confluenceSaveError}
                    </p>
                  )}
                  {confluenceModalMode === 'edit' && (
                    <p className="text-xs text-gray-500">
                      Update your Confluence site, credentials, or space key, then <strong className="text-gray-400">Save</strong>. You stay connected — no need to disconnect first.
                    </p>
                  )}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">
                      Confluence URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://your-domain.atlassian.net"
                      value={confluenceSettings.baseUrl}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({ ...prev, baseUrl: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Use your <strong className="text-gray-400">site root</strong> only (e.g.{' '}
                      <code className="text-gray-500">https://xertilox.atlassian.net</code>). If you paste a long page
                      link, we shorten it automatically — paths like{' '}
                      <code className="text-gray-500">/wiki/spaces/…</code> must not stay in this field.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">Email</label>
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={confluenceSettings.email}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">API Token</label>
                    <input
                      type="password"
                      placeholder="Your Atlassian API token"
                      value={confluenceSettings.apiToken}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({ ...prev, apiToken: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Generate at{' '}
                      <a
                        href="https://id.atlassian.com/manage-profile/security/api-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-400 hover:underline"
                      >
                        id.atlassian.com
                      </a>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">Confluence space key</label>
                    <input
                      type="text"
                      placeholder="From Confluence URL: …/wiki/spaces/YOURKEY/overview"
                      value={confluenceSettings.spaceKey}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({
                          ...prev,
                          spaceKey: e.target.value,
                        }))
                      }
                      onBlur={() =>
                        setConfluenceSettings((prev) => ({
                          ...prev,
                          spaceKey: normalizeConfluenceSpaceKey(prev.spaceKey),
                        }))
                      }
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      This is <strong className="text-gray-400">Confluence’s</strong> short code from the browser URL (
                      <code className="text-gray-500">…/wiki/spaces/<strong className="text-gray-400">KEY</strong>/…</code>
                      ). It is <strong className="text-gray-400">not</strong> your ShowcaseIt workspace name,{' '}
                      <strong className="text-gray-400">not</strong> your company name, and only matches “ShowcaseIt” if
                      whoever created the Confluence space chose that as the key (e.g.{' '}
                      <code className="text-gray-500">SHOWCASEIT</code>). Paste the space URL here and we’ll read{' '}
                      <strong className="text-gray-400">KEY</strong> for you.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1.5">
                      Parent Page ID{' '}
                      <span className="text-gray-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789"
                      value={confluenceSettings.parentPageId}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({
                          ...prev,
                          parentPageId: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Numeric ID only (e.g. <code className="text-gray-500">77604454</code>). If you paste a full
                      Confluence URL, we extract the ID for you.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowConfluenceSetup(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfluenceConnect()}
                    disabled={
                      !confluenceSettings.baseUrl ||
                      !confluenceSettings.email ||
                      !confluenceSettings.apiToken ||
                      !confluenceSettings.spaceKey
                    }
                    className="btn-primary flex-1 disabled:opacity-40"
                  >
                    {confluenceModalMode === 'edit' ? 'Save' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Publish Form */}
          {connectedPlatforms.size > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Publish a Guide</h3>
              <p className="text-sm text-gray-500 mb-4">
                Confluence publishing is live. The guide dropdown uses the <strong className="text-gray-400">same list as
                the Guides page</strong> (everything in your database). Publish still uses the Confluence connection for
                the workspace you connected below. You must be a member of that workspace; any guide you select can be
                published to your Confluence. Other platforms here are for future use.
              </p>
              <div className="space-y-4">
                {publishResult && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      publishResult.ok
                        ? 'border-green-700/50 bg-green-950/30 text-green-100'
                        : 'border-red-800/50 bg-red-950/30 text-red-100'
                    }`}
                    role="status"
                  >
                    <p>{publishResult.message}</p>
                    {publishResult.ok && publishResult.url && (
                      <a
                        href={publishResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-brand-400 hover:underline"
                      >
                        Open in Confluence →
                      </a>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Select Guide</label>
                  <select
                    className={inputClass}
                    value={selectedGuideId}
                    onChange={(e) => setSelectedGuideId(e.target.value)}
                    disabled={guidesLoading}
                  >
                    <option value="">{guidesLoading ? 'Loading guides…' : 'Choose a guide...'}</option>
                    {guides?.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title} ({g._count.steps} steps)
                      </option>
                    ))}
                  </select>
                  {guidesError && (
                    <p className="text-xs text-red-300/90 mt-2" role="alert">
                      Could not load guides: {guidesError}
                    </p>
                  )}
                  {!guidesLoading && guides && guides.length === 0 && !guidesError && (
                    <p className="text-xs text-amber-200/90 mt-2">
                      No guides exist yet. Create one from <strong className="text-gray-300">Guides</strong> or generate
                      one from a recording, then return here.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Page title</label>
                  <input
                    type="text"
                    placeholder="Confluence page title..."
                    value={publishTitle}
                    onChange={(e) => setPublishTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Description</label>
                  <textarea
                    placeholder="Shown in the exported guide body when set..."
                    rows={3}
                    value={publishDescription}
                    onChange={(e) => setPublishDescription(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Publish To</label>
                  <div className="flex flex-wrap gap-2">
                    {platforms
                      .filter((p) => connectedPlatforms.has(p.id))
                      .map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={publishTargets[p.id] ?? false}
                            onChange={(e) =>
                              setPublishTargets((prev) => ({ ...prev, [p.id]: e.target.checked }))
                            }
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          <span className="text-sm text-gray-300 flex items-center gap-2">
                            <IconTile icon={p.icon} size="xs" variant="brand" />
                            {p.name}
                            {p.id !== 'confluence' && (
                              <span className="text-[10px] uppercase text-gray-600">soon</span>
                            )}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>

                {connectedPlatforms.has('confluence') && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                    <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <IconTile icon={FileStack} size="xs" variant="brand" />
                      Confluence options
                    </h4>
                    <div className="space-y-3">
                      <p className="text-xs text-gray-600">
                        Screenshots use your existing image URLs inside the page HTML. If Confluence cannot load them,
                        ensure those URLs are publicly reachable.
                      </p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfApplyBrand}
                          onChange={(e) => setCfApplyBrand(e.target.checked)}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span className="text-sm text-gray-400">Apply brand kit (colors, fonts, cover, banners)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfUpdateIfMatch}
                          onChange={(e) => setCfUpdateIfMatch(e.target.checked)}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span className="text-sm text-gray-400">
                          Update existing page if title matches (same space)
                        </span>
                      </label>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Labels</label>
                        <input
                          type="text"
                          placeholder="user-guide, onboarding (comma separated)"
                          value={cfLabels}
                          onChange={(e) => setCfLabels(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-brand-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing}
                  className="btn-primary"
                >
                  {publishing ? 'Publishing...' : 'Publish Now'}
                </button>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}
