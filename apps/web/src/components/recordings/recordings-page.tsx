'use client';

import { useState } from 'react';
import { Mic, Trash2, Video } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi, apiPost, apiDelete } from '@/hooks/use-api';
import { dispatchWorkspaceCelebrate } from '@/lib/ui/workspace-celebrate';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecordingVideoShareActions } from '@/components/recordings/recording-video-share-actions';

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

export function RecordingsPage() {
  const { data: recordings, loading, refetch } = useApi<Recording[]>({ url: '/api/recordings' });
  const [generating, setGenerating] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const router = useRouter();

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

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
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <IconTile icon={Video} size="md" variant="brand" />
                    <div>
                      <h4 className="font-medium text-gray-200">{rec.title}</h4>
                      <p className="text-xs text-gray-500">
                        {formatDuration(rec.duration)} &middot; {new Date(rec.createdAt).toLocaleDateString()}
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
            </div>
          )}
        </div>
    </AppShell>
  );
}
