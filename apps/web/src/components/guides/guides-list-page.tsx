'use client';

import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi, apiPost } from '@/hooks/use-api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { ListSearchInput } from '@/components/ui/list-search-input';
import { solidBrandHex } from '@/lib/brand/brand-color-value';
import { matchesListSearch } from '@/lib/ui/matches-list-search';
import { useAuth } from '@/lib/auth/auth-context';

/** 12 rows × 3 columns at the `lg` grid breakpoint (see grid below). */
const GUIDES_PAGE_SIZE = 36;

type BrandKitPreview = {
  name: string;
  logoUrl: string | null;
  guideCoverImageUrl: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorBackground: string;
};

interface Guide {
  id: string;
  title: string;
  description: string | null;
  style: string;
  published: boolean;
  updatedAt: string;
  _count: { steps: number };
  steps?: { screenshotUrl: string | null; styledScreenshotUrl: string | null }[];
  brandKit?: BrandKitPreview | null;
  project?: { brandKit: BrandKitPreview | null } | null;
}

function guideCoverUrl(guide: Guide): string | null {
  const s = guide.steps?.[0];
  if (!s) return null;
  return s.styledScreenshotUrl || s.screenshotUrl || null;
}

function effectiveBrandKit(guide: Guide): BrandKitPreview | null {
  return guide.brandKit ?? guide.project?.brandKit ?? null;
}

function GuideCardCover({ guide }: { guide: Guide }) {
  const stepUrl = guideCoverUrl(guide);
  const bk = effectiveBrandKit(guide);
  /** Brand kit “Guide cover” image is the standard list thumbnail when set — don’t let a raw step screenshot override it. */
  const url = bk?.guideCoverImageUrl || stepUrl || null;

  if (url) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg mb-4 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote blob URLs */}
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  const primary = solidBrandHex(bk?.colorPrimary, '#2563EB');
  const secondary = solidBrandHex(bk?.colorSecondary, '#7C3AED');
  const bg = solidBrandHex(bk?.colorBackground, '#0f172a');

  return (
    <div
      className="aspect-video rounded-lg mb-4 overflow-hidden flex items-center justify-center relative"
      style={{
        background: `linear-gradient(135deg, ${primary}66 0%, ${secondary}aa 55%, ${bg} 100%)`,
      }}
    >
      {bk?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bk.logoUrl}
          alt=""
          className="max-h-[42%] max-w-[58%] object-contain drop-shadow-lg"
        />
      ) : (
        <span className="text-white/95 text-3xl font-bold tracking-tight drop-shadow-md">
          {(guide.title || bk?.name || 'Guide').trim().slice(0, 2).toUpperCase() || 'G'}
        </span>
      )}
    </div>
  );
}

export function GuidesListPage() {
  const { user } = useAuth();
  const { data: guides, loading, error, refetch } = useApi<Guide[]>({ url: '/api/guides' });
  const guideList = Array.isArray(guides) ? guides : [];
  const listError =
    error ||
    (guides != null && !Array.isArray(guides) ? 'Unexpected response from server. Try refreshing.' : null);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuides = useMemo(() => {
    if (!guideList.length) return [];
    return guideList.filter((g) => {
      const bk = effectiveBrandKit(g);
      const stepCount = g._count.steps;
      const blob = [
        g.title,
        g.description ?? '',
        bk?.name ?? '',
        g.published ? 'published' : 'draft',
        String(stepCount),
        stepCount === 1 ? '1 step' : `${stepCount} steps`,
        new Date(g.updatedAt).toLocaleDateString(),
        new Date(g.updatedAt).toISOString().slice(0, 10),
      ].join(' ');
      return matchesListSearch(searchQuery, blob);
    });
  }, [guideList, searchQuery]);

  const totalCount = filteredGuides.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / GUIDES_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, totalCount]);

  const paginatedGuides = useMemo(() => {
    if (!filteredGuides.length) return [];
    const start = (page - 1) * GUIDES_PAGE_SIZE;
    return filteredGuides.slice(start, start + GUIDES_PAGE_SIZE);
  }, [filteredGuides, page]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * GUIDES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * GUIDES_PAGE_SIZE, totalCount);

  async function handleCreateBlankGuide() {
    setCreating(true);
    try {
      const guide = await apiPost<{ id: string }>('/api/guides', {
        title: 'Untitled Guide',
        description: '',
        style: 'business',
        userId: user?.id,
      });
      if (guide?.id) {
        router.push(`/guides/${guide.id}`);
      } else {
        refetch();
      }
    } catch {
      refetch();
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Guides</h2>
              <p className="text-gray-400 mt-1">Create and manage your step-by-step guides</p>
            </div>
            {guideList.length > 0 && (
              <button onClick={handleCreateBlankGuide} disabled={creating} className="btn-primary">
                {creating ? 'Creating...' : '+ New Guide'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="card p-16 text-center"><p className="text-gray-500">Loading guides...</p></div>
          ) : listError ? (
            <div className="card p-16 text-center border border-red-900/50 bg-red-950/20">
              <h3 className="text-xl font-semibold text-red-200 mb-2">Couldn&apos;t load guides</h3>
              <p className="text-red-300/90 text-sm mb-2 max-w-lg mx-auto whitespace-pre-wrap">{listError}</p>
              <p className="text-gray-500 text-xs mb-6 max-w-md mx-auto">
                If you recently updated the app, run database migrations:{' '}
                <code className="text-gray-400 bg-gray-900 px-1 rounded">npx prisma migrate dev</code>
                {' '}then restart the dev server.
              </p>
              <button type="button" onClick={() => void refetch()} className="btn-primary">
                Try again
              </button>
            </div>
          ) : guideList.length === 0 ? (
            <div className="card p-16 text-center">
              <div className="flex justify-center mb-4">
                <IconTile icon={BookOpen} size="xl" variant="brand" />
              </div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No guides yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Record your screen first and generate a guide, or create a blank guide and add steps manually.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/recordings/new" className="btn-primary inline-block">Record Screen</Link>
                <button onClick={handleCreateBlankGuide} disabled={creating} className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors">
                  {creating ? 'Creating...' : 'Create Blank Guide'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <ListSearchInput
                id="guides-search"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by title, description, brand, steps, date…"
                className="max-w-xl"
              />
              {filteredGuides.length === 0 ? (
                <div className="card p-12 text-center">
                  <p className="text-gray-400 mb-2">
                    No guides match{' '}
                    <span className="text-gray-200 font-medium">&ldquo;{searchQuery.trim()}&rdquo;</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-brand-400 hover:text-brand-300"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <>
                  <div className="si-stagger-in grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {paginatedGuides.map((guide) => (
                      <Link key={guide.id} href={`/guides/${guide.id}`} className="card-hover cursor-pointer block">
                        <GuideCardCover guide={guide} />
                        <h3 className="font-semibold text-gray-200">{guide.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{guide.description || 'No description'}</p>
                        <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                          <span>{guide._count.steps} steps</span>
                          <span>{new Date(guide.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {totalPages > 1 ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-gray-800/80">
                      <p className="text-sm text-gray-500">
                        Showing <span className="text-gray-400 tabular-nums">{rangeStart}</span>–
                        <span className="text-gray-400 tabular-nums">{rangeEnd}</span> of{' '}
                        <span className="text-gray-400 tabular-nums">{totalCount}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" strokeWidth={2} aria-hidden />
                          Previous
                        </button>
                        <span className="text-sm text-gray-500 px-2 tabular-nums">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
    </AppShell>
  );
}
