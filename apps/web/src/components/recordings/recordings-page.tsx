'use client';

import { useState, useMemo, useEffect } from 'react';
import { useWorkspaceBrand } from '@/components/layout/workspace-brand-context';
import { ChevronLeft, ChevronRight, Mic, Sparkles, Trash2, Video } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth/auth-context';
import { dispatchWorkspaceCelebrate } from '@/lib/ui/workspace-celebrate';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecordingVideoShareActions } from '@/components/recordings/recording-video-share-actions';
import { ListSearchInput } from '@/components/ui/list-search-input';
import { matchesListSearch } from '@/lib/ui/matches-list-search';
import { MarketingExportModal } from '@/components/recordings/marketing-export-modal';
import { BRAND_GRADIENT_PRESETS } from '@/lib/brand/brand-color-value';

/** Matches Brand Kit preset “Ocean deep” — used for inline alerts on this page. */
const RECORDINGS_ALERT_GRADIENT =
  BRAND_GRADIENT_PRESETS.find((p) => p.id === 'ocean-deep')?.value ??
  'linear-gradient(319deg, #02143F 23.29%, #49898A 76.71%)';

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
  project?: {
    id: string;
    name: string;
    workspaceId: string;
    brandKitId: string | null;
    brandKit?: { id: string; name: string } | null;
  } | null;
}

interface WorkspaceProjectOption {
  id: string;
  name: string;
  workspaceId: string;
  brandKitId: string | null;
  brandKit?: { id: string; name: string } | null;
}

const RECORDINGS_PAGE_SIZE = 20;

function sameWorkspaceId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function projectOptionLabel(p: WorkspaceProjectOption): string {
  return p.brandKit?.name ? `${p.brandKit.name} — ${p.name}` : p.name;
}

/** Projects in `rec.project.workspaceId` the member can target, including the recording’s current project if missing from the list. */
function buildRowProjects(
  rec: Recording,
  workspaceProjects: WorkspaceProjectOption[] | null | undefined
): WorkspaceProjectOption[] {
  const inWorkspace =
    workspaceProjects?.filter((p) => sameWorkspaceId(p.workspaceId, rec.project?.workspaceId)) ?? [];
  if (rec.project && !inWorkspace.some((p) => p.id === rec.projectId)) {
    return [
      {
        id: rec.project.id,
        name: rec.project.name,
        workspaceId: rec.project.workspaceId,
        brandKitId: rec.project.brandKitId,
        brandKit: rec.project.brandKit ?? null,
      },
      ...inWorkspace,
    ];
  }
  return inWorkspace;
}

function formatRecordingDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function RecordingsPage() {
  const { user } = useAuth();
  const { preferredWorkspaceId, activeBrandKitId, brandKits } = useWorkspaceBrand();
  /** All projects in workspaces the user belongs to — filtered per row by each recording's workspace. */
  const projectsUrl = user?.id
    ? `/api/projects?userId=${encodeURIComponent(user.id)}`
    : '';
  const { data: workspaceProjects } = useApi<WorkspaceProjectOption[]>({ url: projectsUrl });
  const [movingRecordingId, setMovingRecordingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  /** Unscoped when “All brands” — recordings tied to legacy/other projects remain listed. */
  const recordingsUrl = useMemo(() => {
    if (!activeBrandKitId || !preferredWorkspaceId) return '/api/recordings';
    const qs = new URLSearchParams({
      workspaceId: preferredWorkspaceId,
      brandKitId: activeBrandKitId,
    });
    return `/api/recordings?${qs}`;
  }, [preferredWorkspaceId, activeBrandKitId]);
  const { data: recordings, loading, error: recordingsError, refetch } = useApi<Recording[]>({
    url: recordingsUrl,
  });
  const [generating, setGenerating] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketingRecording, setMarketingRecording] = useState<Recording | null>(null);
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
        rec.project?.name ?? '',
        rec.project?.brandKit?.name ?? '',
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

  useEffect(() => {
    setMoveError(null);
  }, [recordingsUrl, searchQuery]);

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
              {activeBrandKitId ? (
                <p className="text-sm text-brand-400/90 mt-2">
                  Filter:{' '}
                  <span className="font-medium text-brand-300">
                    {brandKits?.find((k) => k.id === activeBrandKitId)?.name ?? 'this brand'}
                  </span>
                  .
                  {brandKits && brandKits.length > 0 ? (
                    <>
                      {' '}
                      Under the logo, open <span className="text-gray-400">Guides &amp; recordings</span> and choose{' '}
                      <span className="text-gray-400">All brands</span> to see everything again.
                    </>
                  ) : null}
                </p>
              ) : brandKits && brandKits.length > 0 ? (
                <p className="text-sm text-gray-500 mt-2">
                  Showing <span className="text-gray-400">All brands</span> — every recording you can access. Under the
                  logo, use <span className="text-gray-400">Guides &amp; recordings</span> in the sidebar to narrow by
                  brand.
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  Showing every recording you can access. Add a brand under{' '}
                  <span className="text-gray-400">Brand Kit</span> to enable filtering here and under the logo in the
                  sidebar.
                </p>
              )}
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
            <div className="space-y-3 mb-6 max-w-3xl">
              <ListSearchInput
                id="recordings-search"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by title, date, status, duration…"
                className="max-w-xl"
              />
            </div>
          ) : null}

          {loading ? (
            <div className="card p-16 text-center">
              <p className="text-gray-500">Loading recordings...</p>
            </div>
          ) : recordingsError ? (
            <div className="card p-16 text-center max-w-lg mx-auto">
              <h3 className="text-xl font-semibold text-gray-200 mb-2">Could not load recordings</h3>
              <p className="text-gray-500 mb-4">{recordingsError}</p>
              <p className="text-sm text-gray-600 mb-6">
                If you see &ldquo;Unauthorized&rdquo;, try signing out and back in. The list uses your signed-in session,
                not your email domain alone.
              </p>
              <button type="button" onClick={() => void refetch()} className="btn-primary">
                Try again
              </button>
            </div>
          ) : !recordings?.length ? (
            <div className="card p-16 text-center">
              <div className="flex justify-center mb-4">
                <IconTile icon={Video} size="xl" variant="brand" />
              </div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No recordings yet</h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Record your screen to auto-generate step-by-step guides, or use video (voice optional) for clips you can
                share or embed.
              </p>
              <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto leading-relaxed">
                When you record while signed in, your captures will show up here. If you work with teammates, you may also
                see recordings from shared workspaces once you&apos;ve been invited on the{' '}
                <Link href="/team" className="text-gray-400 underline-offset-2 hover:underline hover:text-gray-300">
                  Team
                </Link>{' '}
                page. If something you expect is missing, your admin can check that you&apos;re in the same workspace as
                those captures.
              </p>
              {activeBrandKitId && brandKits && brandKits.length > 1 ? (
                <p className="text-sm text-gray-500 mb-6 max-w-lg mx-auto">
                  This brand filter only shows recordings stored on that brand&apos;s project. Under the logo, choose{' '}
                  <span className="text-gray-400">All brands</span> to list everything (including captures made while All
                  brands was selected), then use the <span className="text-gray-400">Brand</span> dropdown on each row to
                  move a recording onto this brand.
                </p>
              ) : null}
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
                  className="rounded-lg border border-white/15 px-4 py-3 text-sm text-center text-white shadow-lg shadow-black/20"
                  style={{ background: RECORDINGS_ALERT_GRADIENT }}
                  role="alert"
                >
                  {generateError}
                </div>
              ) : null}
              {moveError ? (
                <div
                  className="rounded-lg border border-white/15 px-4 py-3 text-sm text-center text-white flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 shadow-lg shadow-black/20"
                  style={{ background: RECORDINGS_ALERT_GRADIENT }}
                  role="alert"
                >
                  <span>{moveError}</span>
                  <button
                    type="button"
                    onClick={() => setMoveError(null)}
                    className="text-xs font-medium text-white/85 hover:text-white underline underline-offset-2"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {paginatedRecordings.map((rec) => {
                const rowProjects = buildRowProjects(rec, workspaceProjects);
                const showProjectRow =
                  Boolean(user?.id) && rowProjects.length > 0 && Boolean(rec.project?.workspaceId);
                const showSelect = rowProjects.length > 1;
                const currentRowProject =
                  rowProjects.find((p) => p.id === rec.projectId) ?? rowProjects[0] ?? null;
                return (
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
                      {showProjectRow ? (
                        <div className="mt-2 flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {showSelect ? (
                              <label className="text-[10px] text-gray-600 shrink-0" htmlFor={`rec-proj-${rec.id}`}>
                                Brand
                              </label>
                            ) : (
                              <span className="text-[10px] text-gray-600 shrink-0">Brand</span>
                            )}
                            {showSelect ? (
                              <select
                                id={`rec-proj-${rec.id}`}
                                value={rec.projectId}
                                disabled={movingRecordingId === rec.id}
                                onChange={async (e) => {
                                  const uid = user?.id;
                                  const next = e.target.value.trim();
                                  if (!uid || !next || next === rec.projectId) return;
                                  const target = rowProjects.find((p) => p.id === next);
                                  if (
                                    !target ||
                                    !sameWorkspaceId(target.workspaceId, rec.project?.workspaceId)
                                  ) {
                                    setMoveError(
                                      "That project is not in this recording's workspace. Refresh the page and try again."
                                    );
                                    return;
                                  }
                                  setMoveError(null);
                                  setMovingRecordingId(rec.id);
                                  try {
                                    await apiPatch(`/api/recordings/${rec.id}`, {
                                      projectId: next,
                                    });
                                    await refetch();
                                  } catch (err) {
                                    setMoveError(err instanceof Error ? err.message : 'Could not move recording');
                                  } finally {
                                    setMovingRecordingId(null);
                                  }
                                }}
                                className="max-w-[min(100%,18rem)] rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 outline-none focus:border-brand-600 disabled:opacity-50"
                              >
                                {rowProjects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {projectOptionLabel(p)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-300 max-w-[min(100%,18rem)] truncate" title={currentRowProject ? projectOptionLabel(currentRowProject) : undefined}>
                                {currentRowProject ? projectOptionLabel(currentRowProject) : rec.projectId}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : null}
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
                    {rec.status === 'ready' && rec.videoUrl ? (
                      <button
                        type="button"
                        onClick={() => setMarketingRecording(rec)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-500/40 text-violet-200 hover:bg-violet-500/10 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        Marketing export
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
                );
              })}
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
        <MarketingExportModal
          recording={marketingRecording}
          open={Boolean(marketingRecording)}
          onClose={() => setMarketingRecording(null)}
        />
    </AppShell>
  );
}
