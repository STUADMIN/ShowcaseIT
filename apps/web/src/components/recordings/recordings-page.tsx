'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Mic, Trash2, Video } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi, apiPost, apiDelete } from '@/hooks/use-api';
import { dispatchWorkspaceCelebrate } from '@/lib/ui/workspace-celebrate';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecordingVideoShareActions } from '@/components/recordings/recording-video-share-actions';
import { ListSearchInput } from '@/components/ui/list-search-input';
import { matchesListSearch } from '@/lib/ui/matches-list-search';

interface Recording {
  id: string;
  title: string;
  duration: number;
  status: string;
  createdAt: string;
  videoUrl: string | null;
  projectId: string;
  userId: string;
  hasVoiceover?: boolean;
}

const RECORDINGS_PAGE_SIZE = 20;

function formatRecordingDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function RecordingsPage() {
  const { data: recordings, loading, refetch } = useApi<Recording[]>({ url: '/api/recordings' });
  const [generating, setGenerating] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const filteredRecordings = useMemo(() => {
    if (!recordings?.length) return [];
    return recordings.filter((rec) => {
      const blob = [
        rec.title,
        rec.status,
        rec.hasVoiceover ? 'voiceover' : '',
        formatRecordingDuration(rec.duration),
        new Date(rec.createdAt).toLocaleDateString(),
        new Date(rec.createdAt).toISOString().slice(0, 10),
      ].join(' ');
      return matchesListSearch(searchQuery, blob);
    });
  }, [recordings, searchQuery]);

  const totalCount = filteredRecordings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / RECORDINGS_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, totalCount]);

  const paginatedRecordings = useMemo(() => {
    if (!filteredRecordings.length) return [];
    const start = (page - 1) * RECORDINGS_PAGE_SIZE;
    return filteredRecordings.slice(start, start + RECORDINGS_PAGE_SIZE);
  }, [filteredRecordings, page]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * RECORDINGS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * RECORDINGS_PAGE_SIZE, totalCount);

  const handleGenerate = async (rec: Recording) => {
    if (rec.hasVoiceover) return;
    setGenerateError(null);
    setGenerating(rec.id);
    try {
      const guide = await apiPost<{ id: string }>('/api/guides/generate', {
        recordingId: rec.id,
        title: `Guide: ${rec.title}`,
        projectId: rec.projectId,
        userId: rec.userId,
      });
      dispatchWorkspaceCelebrate();
      router.push(`/guides/${guide.id}`);
    } catch (e) {
      setGenerating(null);
      setGenerateError(e instanceof Error ? e.message : 'Could not generate guide');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/recordings/${id}`);
      refetch();
    } catch {}
  };

  return (
    <AppShell>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Recordings</h2>
              <p className="text-gray-400 mt-1">Manage your screen captures and recordings</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Link
                href="/recordings/video"
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-sm font-medium"
              >
                Record video (voice optional)
              </Link>
              <Link
                href="/recordings/cast"
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-sm font-medium"
              >
                Record from phone
              </Link>
              <Link href="/recordings/new" className="btn-primary">
                + New Recording
              </Link>
            </div>
          </div>

          {!loading && recordings && recordings.length > 0 ? (
            <ListSearchInput
              id="recordings-search"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by title, date, status, duration…"
              className="max-w-xl mb-6"
            />
          ) : null}

          {loading ? (
            <div className="card p-16 text-center">
              <p className="text-gray-500">Loading recordings...</p>
            </div>
          ) : !recordings?.length ? (
            <div className="card p-16 text-center">
              <div className="flex justify-center mb-4">
                <IconTile icon={Video} size="xl" variant="brand" />
              </div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No recordings yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Record your screen to auto-generate step-by-step guides, or use video (voice optional) for clips you can
                share or embed.
              </p>
              <Link href="/recordings/new" className="btn-primary inline-block">
                Start Recording
              </Link>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-gray-400 mb-2">
                No recordings match{' '}
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
            <div className="si-stagger-in space-y-3">
              {generateError ? (
                <div
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {generateError}
                </div>
              ) : null}
              {paginatedRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <IconTile icon={Video} size="md" variant="brand" />
                    <div>
                      <h4 className="font-medium text-gray-200">{rec.title}</h4>
                      <p className="text-xs text-gray-500">
                        {formatRecordingDuration(rec.duration)} &middot; {new Date(rec.createdAt).toLocaleDateString()}
                        {rec.hasVoiceover ? (
                          <span className="text-brand-400/90 inline-flex items-center gap-1">
                            {' '}
                            &middot;{' '}
                            <Mic className="w-3.5 h-3.5 inline-block" strokeWidth={2} aria-hidden />
                            voiceover
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
                    <span
                      className={`self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        rec.status === 'ready'
                          ? 'bg-green-600/15 text-green-400'
                          : rec.status === 'processing'
                            ? 'bg-yellow-600/15 text-yellow-400'
                            : 'bg-gray-600/15 text-gray-400'
                      }`}
                    >
                      {rec.status}
                    </span>
                    {rec.status === 'ready' && rec.hasVoiceover && rec.videoUrl ? (
                      <RecordingVideoShareActions videoUrl={rec.videoUrl} />
                    ) : null}
                    {rec.status === 'ready' && rec.hasVoiceover && !rec.videoUrl ? (
                      <span className="text-xs text-gray-500 text-right sm:text-left">
                        Video link not ready yet.
                      </span>
                    ) : null}
                    {rec.status === 'ready' && !rec.hasVoiceover ? (
                      <button
                        type="button"
                        onClick={() => handleGenerate(rec)}
                        disabled={generating === rec.id}
                        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                      >
                        {generating === rec.id ? 'Generating...' : 'Generate Guide'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id)}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete recording"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              {totalCount > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-800/80">
                  <p className="text-sm text-gray-500">
                    Showing <span className="text-gray-400 tabular-nums">{rangeStart}</span>–
                    <span className="text-gray-400 tabular-nums">{rangeEnd}</span> of{' '}
                    <span className="text-gray-400 tabular-nums">{totalCount}</span>
                    {totalPages > 1 ? (
                      <span className="text-gray-600"> · {RECORDINGS_PAGE_SIZE} per page</span>
                    ) : null}
                  </p>
                  <nav className="flex items-center gap-2" aria-label="Recordings pagination">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" strokeWidth={2} aria-hidden />
                      Previous
                    </button>
                    <span className="text-sm text-gray-500 px-2 tabular-nums min-w-[7rem] text-center">
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
                  </nav>
                </div>
              ) : null}
            </div>
          )}
        </div>
    </AppShell>
  );
}
