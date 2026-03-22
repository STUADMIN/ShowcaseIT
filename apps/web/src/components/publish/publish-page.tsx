'use client';

import { useState } from 'react';
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
import { useApi } from '@/hooks/use-api';

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
  const { data: guides } = useApi<Array<{ id: string; title: string; _count: { steps: number } }>>({ url: '/api/guides' });
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [showConfluenceSetup, setShowConfluenceSetup] = useState(false);
  const [confluenceSettings, setConfluenceSettings] = useState<ConfluenceSettings>({
    baseUrl: '',
    email: '',
    apiToken: '',
    spaceKey: '',
    parentPageId: '',
  });
  const [publishing, setPublishing] = useState(false);

  const toggleConnect = (platformId: string) => {
    if (platformId === 'confluence') {
      if (connectedPlatforms.has('confluence')) {
        setConnectedPlatforms((prev) => {
          const next = new Set(prev);
          next.delete('confluence');
          return next;
        });
      } else {
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

  const handleConfluenceConnect = () => {
    if (!confluenceSettings.baseUrl || !confluenceSettings.email || !confluenceSettings.apiToken || !confluenceSettings.spaceKey) {
      return;
    }
    setConnectedPlatforms((prev) => new Set([...prev, 'confluence']));
    setShowConfluenceSetup(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setPublishing(false);
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
                    onClick={() => toggleConnect(platform.id)}
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
                    onClick={() => toggleConnect(platform.id)}
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
                    <h3 className="text-lg font-semibold">Connect Confluence</h3>
                  </div>
                  <button
                    onClick={() => setShowConfluenceSetup(false)}
                    className="text-gray-500 hover:text-gray-300 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
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
                      Your Atlassian Cloud or Server URL
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
                    <label className="text-sm text-gray-400 block mb-1.5">Space Key</label>
                    <input
                      type="text"
                      placeholder="e.g. DOCS, TEAM, ENG"
                      value={confluenceSettings.spaceKey}
                      onChange={(e) =>
                        setConfluenceSettings((prev) => ({
                          ...prev,
                          spaceKey: e.target.value.toUpperCase(),
                        }))
                      }
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      The space where guides will be published
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
                      Nest guide pages under a specific parent page
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowConfluenceSetup(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfluenceConnect}
                    disabled={
                      !confluenceSettings.baseUrl ||
                      !confluenceSettings.email ||
                      !confluenceSettings.apiToken ||
                      !confluenceSettings.spaceKey
                    }
                    className="btn-primary flex-1 disabled:opacity-40"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Publish Form */}
          {connectedPlatforms.size > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Publish a Guide</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Select Guide</label>
                  <select className={inputClass}>
                    <option value="">Choose a guide...</option>
                    {guides?.map((g) => (
                      <option key={g.id} value={g.id}>{g.title} ({g._count.steps} steps)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Title</label>
                  <input type="text" placeholder="Post title..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Description</label>
                  <textarea
                    placeholder="Post description..."
                    rows={3}
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
                            defaultChecked
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          <span className="text-sm text-gray-300 flex items-center gap-2">
                            <IconTile icon={p.icon} size="xs" variant="brand" />
                            {p.name}
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
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span className="text-sm text-gray-400">
                          Include screenshots as page attachments
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span className="text-sm text-gray-400">
                          Apply brand styling (inline CSS)
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600" />
                        <span className="text-sm text-gray-400">
                          Update existing page if title matches
                        </span>
                      </label>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Labels</label>
                        <input
                          type="text"
                          placeholder="user-guide, onboarding (comma separated)"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-brand-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handlePublish}
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
