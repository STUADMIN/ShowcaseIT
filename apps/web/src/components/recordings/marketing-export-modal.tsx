'use client';

import { useEffect, useState } from 'react';
import {
  isMarketingRenderModeImplemented,
  MARKETING_RENDER_MODES,
  MARKETING_RENDER_MODE_LABELS,
  type MarketingRenderMode,
} from '@/lib/marketing-render/modes';
import { apiPost } from '@/hooks/use-api';

/** Modes that can feed AI style pass (must match API / base-marketing-source). */
const BASE_MODES_FOR_AI = new Set(['branded_screen', 'motion_walkthrough', 'branded_plus_motion']);

function pickReadyBaseJob(jobs: JobRow[]): JobRow | null {
  const eligible = jobs.filter(
    (j) =>
      j.status === 'ready' &&
      j.outputUrl?.trim() &&
      BASE_MODES_FOR_AI.has(j.mode)
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return eligible[0] ?? null;
}

type Recording = {
  id: string;
  title: string;
  userId: string;
  videoUrl: string | null;
};

type JobRow = {
  id: string;
  status: string;
  mode: string;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
};

export function MarketingExportModal({
  recording,
  open,
  onClose,
}: {
  recording: Recording | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<MarketingRenderMode>('branded_screen');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pollJob, setPollJob] = useState<{ id: string } | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<JobRow | null>(null);
  const [priorJobs, setPriorJobs] = useState<JobRow[] | null>(null);
  const [priorJobsLoading, setPriorJobsLoading] = useState(false);
  const [priorJobsError, setPriorJobsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setPollJob(null);
      setJobSnapshot(null);
      setBusy(false);
      return;
    }
    setMode('branded_screen');
    setPriorJobs(null);
    setPriorJobsError(null);
  }, [open, recording?.id]);

  useEffect(() => {
    if (!open || !recording || mode !== 'ai_enhanced') {
      if (!open || mode !== 'ai_enhanced') {
        setPriorJobsLoading(false);
      }
      return;
    }
    let cancelled = false;
    setPriorJobsLoading(true);
    setPriorJobsError(null);
    void (async () => {
      try {
        const r = await fetch(
          `/api/recordings/${recording.id}/marketing-renders?userId=${encodeURIComponent(recording.userId)}`
        );
        const data = (await r.json()) as JobRow[] | { error?: string };
        if (cancelled) return;
        if (!r.ok) {
          setPriorJobsError(
            typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Could not load prior exports'
          );
          setPriorJobs([]);
          return;
        }
        setPriorJobs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setPriorJobsError('Could not load prior exports');
          setPriorJobs([]);
        }
      } finally {
        if (!cancelled) setPriorJobsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recording, mode]);

  useEffect(() => {
    if (!pollJob || !recording) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(
          `/api/marketing-renders/${pollJob.id}?userId=${encodeURIComponent(recording.userId)}`
        );
        const data = (await r.json()) as JobRow & { error?: string };
        if (cancelled) return;
        if (!r.ok) {
          setMessage(data.error || 'Could not load job status');
          return;
        }
        setJobSnapshot(data);
        if (data.status === 'ready' || data.status === 'failed') {
          setPollJob(null);
          if (data.status === 'failed') {
            setMessage(data.error || 'Render failed');
          } else {
            setMessage('Render finished — use the link below.');
          }
        } else if (data.status === 'processing') {
          setMessage(
            'Encoding in progress (ffmpeg). Long videos can take several minutes — watch the marketing worker terminal for output or errors.'
          );
        } else if (data.status === 'queued') {
          setMessage(
            'Job queued. If nothing changes, configure a worker or run cron — see Marketing renders doc.'
          );
        }
      } catch {
        if (!cancelled) setMessage('Could not poll job status');
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollJob, recording]);

  if (!open || !recording) return null;

  /** Flat, neutral “marketing illustration” feel (vs default dark chrome). */
  const flatFeel = mode === 'ai_enhanced' || jobSnapshot?.mode === 'ai_enhanced';

  const readyBaseJob = pickReadyBaseJob(priorJobs ?? []);
  /** Wait for list fetch; block if no eligible ready base (avoids opaque API 400). */
  const aiBlocked =
    mode === 'ai_enhanced' &&
    (priorJobsLoading || priorJobs === null || !readyBaseJob);

  const handleSubmit = async () => {
    setMessage(null);
    setBusy(true);
    setJobSnapshot(null);
    try {
      const options: Record<string, unknown> = {
        aspectRatio: '16:9',
        bannerPosition: 'none',
      };
      if (mode === 'ai_enhanced' && readyBaseJob?.id) {
        options.baseMarketingJobId = readyBaseJob.id;
      }

      const job = await apiPost<JobRow>(`/api/recordings/${recording.id}/marketing-renders`, {
        userId: recording.userId,
        mode,
        options,
      });
      setPollJob({ id: job.id });
      setJobSnapshot(job);
      if (job.status === 'queued') {
        setMessage(
          'Job queued. If nothing changes, configure a worker or run cron — see Marketing renders doc.'
        );
      } else if (job.status === 'processing') {
        setMessage(
          'Encoding in progress (ffmpeg). Long videos can take several minutes — watch the marketing worker terminal for output or errors.'
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not create job');
      if (mode === 'ai_enhanced' && open && recording) {
        setPriorJobsLoading(true);
        try {
          const r = await fetch(
            `/api/recordings/${recording.id}/marketing-renders?userId=${encodeURIComponent(recording.userId)}`
          );
          const data = (await r.json()) as JobRow[] | { error?: string };
          if (r.ok && Array.isArray(data)) setPriorJobs(data);
        } catch {
          /* ignore */
        } finally {
          setPriorJobsLoading(false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        flatFeel
          ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/35 backdrop-blur-[2px]'
          : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'
      }
    >
      <div
        className={
          flatFeel
            ? 'w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-300/90 bg-[#f4f1ea] p-6 shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
            : 'card w-full max-w-lg max-h-[90vh] overflow-y-auto'
        }
        role="dialog"
        aria-labelledby="marketing-export-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3
            id="marketing-export-title"
            className={
              flatFeel
                ? 'text-lg font-semibold tracking-tight text-stone-900'
                : 'text-lg font-semibold text-gray-100'
            }
          >
            Marketing export
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={
              flatFeel
                ? 'text-stone-500 hover:text-stone-800 text-xl leading-none'
                : 'text-gray-500 hover:text-gray-300 text-xl leading-none'
            }
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={flatFeel ? 'text-sm text-stone-600 mb-4' : 'text-sm text-gray-400 mb-4'}>
          Create a render job for{' '}
          <span className={flatFeel ? 'font-medium text-stone-800' : 'text-gray-200'}>
            {recording.title}
          </span>
          . Heavy encoding runs on a{' '}
          <strong className={flatFeel ? 'font-semibold text-stone-800' : 'text-gray-300'}>worker</strong>, not
          inside a short serverless request. See{' '}
          <code
            className={
              flatFeel ? 'text-[11px] text-stone-500' : 'text-gray-400 text-xs'
            }
          >
            apps/web/docs/MARKETING_RENDERS.md
          </code>{' '}
          in the repo for API, cron, and Vercel limits.
        </p>

        {mode === 'motion_walkthrough' ? (
          <p
            className={
              flatFeel
                ? 'text-xs text-stone-600 mb-3 -mt-2'
                : 'text-xs text-gray-500 mb-3 -mt-2'
            }
          >
            Uses saved click / step markers on the recording. Desktop captures with click tracking give
            the best results; pure step markers flash at the center of the framed screen.
          </p>
        ) : null}
        {mode === 'ai_enhanced' ? (
          <p className="text-xs text-stone-600 mb-3 -mt-2 leading-relaxed">
            Run <strong className="font-medium text-stone-800">Branded screen</strong> or{' '}
            <strong className="font-medium text-stone-800">Animated walkthrough</strong> first and wait until
            that job is <strong className="font-medium text-stone-800">ready</strong>. This pass adds a{' '}
            <strong className="font-medium text-stone-800">clean, flat polish</strong> (muted contrast, calm
            tones) — closer to a minimal marketing graphic than a raw screen capture. No bottom banner strip is
            added to the video.
          </p>
        ) : null}

        <label
          className={flatFeel ? 'text-sm text-stone-700 block mb-2' : 'text-sm text-gray-400 block mb-2'}
        >
          Pipeline mode
        </label>
        <select
          className={
            flatFeel
              ? 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 mb-4 shadow-sm'
              : 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 mb-4'
          }
          value={mode}
          onChange={(e) => setMode(e.target.value as MarketingRenderMode)}
        >
          {MARKETING_RENDER_MODES.map((m) => {
            const ok = isMarketingRenderModeImplemented(m);
            return (
              <option key={m} value={m} disabled={!ok}>
                {MARKETING_RENDER_MODE_LABELS[m]}
                {!ok ? ' — coming soon' : ''}
              </option>
            );
          })}
        </select>

        {mode === 'ai_enhanced' ? (
          <div className="mb-4 space-y-2">
            {priorJobsLoading ? (
              <p className="text-xs text-stone-500">Checking for a finished export for this recording…</p>
            ) : priorJobsError ? (
              <p className="text-xs text-red-800 bg-red-100/80 border border-red-200 rounded-lg px-3 py-2">
                {priorJobsError}
              </p>
            ) : readyBaseJob ? (
              <div className="text-xs text-emerald-900 bg-emerald-100/80 border border-emerald-200/90 rounded-lg px-3 py-2 space-y-1">
                <p className="font-medium">Ready to polish</p>
                <p className="text-emerald-900/95">
                  Using your latest finished{' '}
                  <span className="font-medium">{MARKETING_RENDER_MODE_LABELS[readyBaseJob.mode as MarketingRenderMode] ?? readyBaseJob.mode}</span>{' '}
                  ({new Date(readyBaseJob.createdAt).toLocaleString()}). AI style pass will run on that file.
                </p>
              </div>
            ) : (
              <div className="text-xs text-stone-800 bg-amber-100/70 border border-amber-200/80 rounded-lg px-3 py-2 space-y-2">
                <p className="font-medium">Create a base export first</p>
                <ol className="list-decimal list-inside space-y-1 text-stone-800/95">
                  <li>
                    Choose <strong>Branded screen recording</strong>, <strong>Animated walkthrough</strong>, or{' '}
                    <strong>Branded + motion</strong> above.
                  </li>
                  <li>Click <strong>Create job</strong> and wait until status is <strong>ready</strong> (worker running).</li>
                  <li>Switch back to <strong>AI style pass</strong> and create this job again.</li>
                </ol>
                <button
                  type="button"
                  className="rounded-md border border-amber-400/80 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-800 hover:bg-amber-50/90"
                  onClick={() => {
                    setMessage(null);
                    setMode('branded_screen');
                  }}
                >
                  Switch to Branded screen to run step 1
                </button>
                {(priorJobs?.length ?? 0) > 0 ? (
                  <div className="pt-1 border-t border-amber-200/60">
                    <p className="font-medium text-stone-800 mb-1">Recent jobs for this recording</p>
                    <ul className="space-y-0.5 text-[11px] text-stone-700">
                      {priorJobs!.slice(0, 6).map((j) => (
                        <li key={j.id}>
                          <span className="font-medium">{j.status}</span>
                          {' · '}
                          {MARKETING_RENDER_MODE_LABELS[j.mode as MarketingRenderMode] ?? j.mode}
                          {' · '}
                          {new Date(j.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-600 pt-1">No marketing jobs yet for this recording.</p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {message ? (
          <p
            className={
              flatFeel
                ? jobSnapshot?.status === 'processing'
                  ? 'text-xs text-stone-800 bg-stone-200/80 border border-stone-300 rounded-lg px-3 py-2 mb-4'
                  : jobSnapshot?.status === 'failed'
                    ? 'text-xs text-red-900 bg-red-100/90 border border-red-200 rounded-lg px-3 py-2 mb-4'
                    : message.includes('Render finished')
                      ? 'text-xs text-emerald-900 bg-emerald-100/80 border border-emerald-200/90 rounded-lg px-3 py-2 mb-4'
                      : 'text-xs text-stone-800 bg-amber-100/70 border border-amber-200/80 rounded-lg px-3 py-2 mb-4'
                : jobSnapshot?.status === 'processing'
                  ? 'text-xs text-sky-100/95 bg-sky-950/40 border border-sky-800/50 rounded-lg px-3 py-2 mb-4'
                  : jobSnapshot?.status === 'failed'
                    ? 'text-xs text-red-100/95 bg-red-950/35 border border-red-900/50 rounded-lg px-3 py-2 mb-4'
                    : message.includes('Render finished')
                      ? 'text-xs text-emerald-100/95 bg-emerald-950/35 border border-emerald-800/50 rounded-lg px-3 py-2 mb-4'
                      : 'text-xs text-amber-100/95 bg-amber-950/35 border border-amber-800/50 rounded-lg px-3 py-2 mb-4'
            }
          >
            {message}
          </p>
        ) : null}

        {jobSnapshot?.status === 'processing' && !flatFeel ? (
          <p className="text-xs text-gray-500 mb-4 -mt-2">
            Keep <code className="text-gray-600 text-[11px]">npm run worker:marketing</code> running in a
            terminal. If the dev server or worker restarts mid-encode, status can stick until the worker
            marks stale jobs failed (~3 min by default, configurable — see{' '}
            <code className="text-gray-600 text-[11px]">MARKETING_RENDERS.md</code>).
          </p>
        ) : null}

        {jobSnapshot ? (
          <div
            className={
              flatFeel
                ? 'text-xs text-stone-600 mb-4 space-y-1'
                : 'text-xs text-gray-500 mb-4 space-y-1'
            }
          >
            <p>
              Status:{' '}
              <span className={flatFeel ? 'text-stone-900 font-medium' : 'text-gray-300'}>
                {jobSnapshot.status}
              </span>{' '}
              · Mode:{' '}
              <span className={flatFeel ? 'text-stone-900 font-medium' : 'text-gray-300'}>
                {jobSnapshot.mode}
              </span>
            </p>
            {jobSnapshot.outputUrl ? (
              <a
                href={jobSnapshot.outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  flatFeel
                    ? 'text-stone-800 underline decoration-stone-400 underline-offset-2 hover:text-stone-950 break-all'
                    : 'text-brand-400 hover:underline break-all'
                }
              >
                Open output
              </a>
            ) : null}
            {jobSnapshot.error ? (
              <p
                className={
                  flatFeel
                    ? 'text-red-800 break-words [overflow-wrap:anywhere]'
                    : 'text-red-300/95 break-words [overflow-wrap:anywhere]'
                }
              >
                {jobSnapshot.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {pollJob ? (
          <button
            type="button"
            className={
              flatFeel
                ? 'text-xs text-stone-500 hover:text-stone-800 mb-3'
                : 'text-xs text-gray-500 hover:text-gray-300 mb-3'
            }
            onClick={() => setPollJob(null)}
          >
            Stop polling (job keeps running on the server)
          </button>
        ) : null}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className={
              flatFeel
                ? 'rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50'
                : 'btn-secondary text-sm'
            }
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !!pollJob || aiBlocked}
            title={
              aiBlocked && mode === 'ai_enhanced'
                ? priorJobsLoading || priorJobs === null
                  ? 'Checking for a finished base export…'
                  : 'Finish a Branded, Walkthrough, or Branded + motion export first (status must be ready)'
                : undefined
            }
            className={
              flatFeel
                ? 'rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-[#f4f1ea] shadow-sm hover:bg-stone-800 disabled:opacity-50'
                : 'btn-primary text-sm disabled:opacity-50'
            }
          >
            {busy ? 'Creating…' : pollJob ? 'Polling…' : 'Create job'}
          </button>
        </div>
      </div>
    </div>
  );
}
