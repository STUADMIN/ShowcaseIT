'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  FileText,
  HelpCircle,
  Search,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi } from '@/hooks/use-api';

interface HelpGuide {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { steps: number };
  steps: {
    id: string;
    order: number;
    title: string;
    screenshotUrl: string | null;
    styledScreenshotUrl: string | null;
  }[];
}

const CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  'getting-started': {
    label: 'Getting Started',
    keywords: ['dashboard', 'onboarding', 'sign', 'login', 'workspace'],
  },
  recordings: {
    label: 'Recordings',
    keywords: ['recording', 'record', 'capture', 'video'],
  },
  guides: {
    label: 'Guides',
    keywords: ['guide', 'step', 'walkthrough', 'editor'],
  },
  branding: {
    label: 'Branding & Publishing',
    keywords: ['brand', 'publish', 'export', 'share'],
  },
  team: {
    label: 'Team & Settings',
    keywords: ['team', 'setting', 'member', 'workspace', 'notification'],
  },
};

function categorize(guide: HelpGuide): string {
  const text = `${guide.title} ${guide.description ?? ''}`.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some((kw) => text.includes(kw))) return key;
  }
  return 'general';
}

function coverUrl(guide: HelpGuide): string | null {
  const first = guide.steps[0];
  if (!first) return null;
  return first.styledScreenshotUrl || first.screenshotUrl || null;
}

export function HelpPage() {
  const { data, loading, error } = useApi<HelpGuide[]>({ url: '/api/help' });
  const guides = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, HelpGuide[]>();
    for (const g of guides) {
      const cat = categorize(g);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    return map;
  }, [guides]);

  const filtered = useMemo(() => {
    let list = guides;
    if (activeCategory) {
      list = list.filter((g) => categorize(g) === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          (g.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [guides, search, activeCategory]);

  const categoryEntries = useMemo(() => {
    const entries: { key: string; label: string; count: number }[] = [];
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const count = grouped.get(key)?.length ?? 0;
      if (count > 0) entries.push({ key, label: cat.label, count });
    }
    const generalCount = grouped.get('general')?.length ?? 0;
    if (generalCount > 0) entries.push({ key: 'general', label: 'General', count: generalCount });
    return entries;
  }, [grouped]);

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* TOC sidebar */}
        <aside className="hidden lg:flex w-72 flex-col border-r border-gray-800 bg-gray-950/60 overflow-y-auto">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <IconTile icon={HelpCircle} size="sm" variant="brand" />
              <h2 className="text-lg font-bold text-gray-100">Help Centre</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:border-brand-600 transition-colors"
              />
            </div>
          </div>

          <nav className="flex-1 p-4">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
                !activeCategory
                  ? 'bg-brand-600/10 text-brand-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              All articles
              <span className="ml-2 text-xs text-gray-600">{guides.length}</span>
            </button>

            {categoryEntries.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() =>
                  setActiveCategory(activeCategory === cat.key ? null : cat.key)
                }
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-brand-600/10 text-brand-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {cat.label}
                <span className="ml-2 text-xs text-gray-600">{cat.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-100">Documentation</h1>
              <p className="text-gray-400 mt-1">
                Step-by-step guides for every part of ShowcaseIT
              </p>
            </div>

            {/* Mobile search */}
            <div className="lg:hidden mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search docs..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:border-brand-600 transition-colors"
                />
              </div>
            </div>

            {loading ? (
              <div className="card p-16 text-center">
                <p className="text-gray-500">Loading documentation...</p>
              </div>
            ) : error ? (
              <div className="card p-16 text-center border border-red-900/50 bg-red-950/20">
                <p className="text-red-300/90 text-sm">{error}</p>
              </div>
            ) : guides.length === 0 ? (
              <div className="card p-16 text-center">
                <div className="flex justify-center mb-4">
                  <IconTile icon={BookOpen} size="xl" variant="brand" />
                </div>
                <h3 className="text-xl font-semibold text-gray-200 mb-2">
                  No documentation yet
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Documentation guides will appear here once generated. Run the
                  auto-documentation pipeline to get started.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-gray-400 mb-2">
                  No articles match your search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setActiveCategory(null);
                  }}
                  className="text-sm text-brand-400 hover:text-brand-300"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 si-stagger-in">
                {filtered.map((guide) => (
                  <Link
                    key={guide.id}
                    href={`/help/${guide.id}`}
                    className="group card-hover block"
                  >
                    {coverUrl(guide) ? (
                      <div className="aspect-video bg-gray-900 rounded-lg mb-4 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverUrl(guide)!}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg mb-4 bg-gradient-to-br from-brand-600/30 to-gray-900 flex items-center justify-center">
                        <FileText className="w-10 h-10 text-brand-400/60" />
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-200 group-hover:text-brand-400 transition-colors flex items-center gap-2">
                      {guide.title}
                      <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {cleanDescription(guide.description)}
                    </p>
                    <p className="text-xs text-gray-600 mt-3">
                      {guide._count.steps} step{guide._count.steps !== 1 ? 's' : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function cleanDescription(desc: string | null): string {
  if (!desc) return 'No description';
  return desc.replace(/\[auto-doc:[^\]]+\]/g, '').trim() || 'No description';
}
