'use client';

import { useEffect, useState } from 'react';
import { MARKETING_RENDER_MODE_LABELS, type MarketingRenderMode } from '@/lib/marketing-render/modes';
import { apiPost } from '@/hooks/use-api';

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pollJob, setPollJob] = useState<{ id: string } | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<JobRow | null>(null);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setPollJob(null);
      setJobSnapshot(null);
      setBusy(false);
    }
  }, [open, recording?.id]);

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
            'Encoding in progress (ffmpeg). Long videos can take several minutes — check the terminal running `next dev` or the marketing worker.'
          );
        } else if (data.status === 'queued') {
          setMessage(
            'Job queued — in `next dev`, encoding usually starts in the background within a few seconds. If this never changes, run `npm run worker:marketing` from the repo. See apps/web/docs/MARKETING_RENDERS.md.'
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

  const handleSubmit = async () => {
    setMessage(null);
    setBusy(true);
    setJobSnapshot(null);
    try {
      const job = await apiPost<JobRow>(`/api/recordings/${recording.id}/marketing-renders`, {
        userId: recording.userId,
        mode: 'branded_screen',
        options: {
          aspectRatio: '16:9',
          bannerPosition: 'none',
        },
      });
      setPollJob({ id: job.id });
      setJobSnapshot(job);
      if (job.status === 'queued') {
        setMessage(
          'Job created — in `next dev`, ffmpeg should start in the background shortly. If it stays queued, run `npm run worker:marketing` or see apps/web/docs/MARKETING_RENDERS.md.'
        );
      } else if (job.status === 'processing') {
        setMessage(
          'Encoding in progress (ffmpeg). Long videos can take several minutes — check the terminal running `next dev` or the marketing worker.'
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not create job');
    } finally {
      setBusy(false);
    }
  };

  const modeLabel =
    jobSnapshot?.mode != null
      ? (MARKETING_RENDER_MODE_LABELS[jobSnapshot.mode as MarketingRenderMode] ?? jobSnapshot.mode)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="marketing-export-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 id="marketing-export-title" className="text-lg font-semibold text-gray-100">
            Marketing export
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Export <span className="text-gray-200">{recording.title}</span> as a{' '}
          <strong className="text-gray-300">16:9 branded MP4</strong> (letterboxed with your Brand Kit primary color).
          Optional intro/outro stills use your <strong className="text-gray-300">Guide cover</strong> and{' '}
          <strong className="text-gray-300">Video outro</strong> assets when set. Encoding runs in the background
          during <code className="text-gray-500 text-xs">next dev</code>, or via{' '}
          <code className="text-gray-500 text-xs">npm run worker:marketing</code> — see{' '}
          <code className="text-gray-400 text-xs">apps/web/docs/MARKETING_RENDERS.md</code>.
        </p>

        {message ? (
          <p
            className={
              jobSnapshot?.status === 'processing'
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

        {jobSnapshot?.status === 'processing' ? (
          <p className="text-xs text-gray-500 mb-4 -mt-2">
            If encoding stops mid-way, stale jobs are marked failed after a few minutes (
            <code className="text-gray-600 text-[11px]">MARKETING_RENDERS.md</code>).
          </p>
        ) : null}

        {jobSnapshot ? (
          <div className="text-xs text-gray-500 mb-4 space-y-1">
            <p>
              Status: <span className="text-gray-300">{jobSnapshot.status}</span>
              {modeLabel ? (
                <>
                  {' '}
                  · <span className="text-gray-300">{modeLabel}</span>
                </>
              ) : null}
            </p>
            {jobSnapshot.outputUrl ? (
              <a
                href={jobSnapshot.outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:underline break-all"
              >
                Open output
              </a>
            ) : null}
            {jobSnapshot.error ? (
              <p className="text-red-300/95 break-words [overflow-wrap:anywhere]">{jobSnapshot.error}</p>
            ) : null}
          </div>
        ) : null}

        {pollJob ? (
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-300 mb-3"
            onClick={() => setPollJob(null)}
          >
            Stop polling (job keeps running on the server)
          </button>
        ) : null}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !!pollJob}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : pollJob ? 'Polling…' : 'Create export'}
          </button>
        </div>
      </div>
    </div>
  );
}
