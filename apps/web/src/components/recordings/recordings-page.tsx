'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost, apiDelete } from '@/hooks/use-api';
import { dispatchWorkspaceCelebrate } from '@/lib/ui/workspace-celebrate';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Recording {
  id: string;
  title: string;
  duration: number;
  status: string;
  createdAt: string;
  videoUrl: string | null;
  projectId: string;
  userId: string;
}

export function RecordingsPage() {
  const { data: recordings, loading, refetch } = useApi<Recording[]>({ url: '/api/recordings' });
  const [generating, setGenerating] = useState<string | null>(null);
  const router = useRouter();

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const handleGenerate = async (rec: Recording) => {
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
    } catch {
      setGenerating(null);
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
            <Link href="/recordings/new" className="btn-primary">
              + New Recording
            </Link>
          </div>

          {loading ? (
            <div className="card p-16 text-center">
              <p className="text-gray-500">Loading recordings...</p>
            </div>
          ) : !recordings?.length ? (
            <div className="card p-16 text-center">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No recordings yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Record your screen to auto-generate step-by-step guides
              </p>
              <Link href="/recordings/new" className="btn-primary inline-block">
                Start Recording
              </Link>
            </div>
          ) : (
            <div className="si-stagger-in space-y-3">
              {recordings.map((rec) => (
                <div key={rec.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-xl">🎬</div>
                    <div>
                      <h4 className="font-medium text-gray-200">{rec.title}</h4>
                      <p className="text-xs text-gray-500">
                        {formatDuration(rec.duration)} &middot; {new Date(rec.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      rec.status === 'ready' ? 'bg-green-600/15 text-green-400' :
                      rec.status === 'processing' ? 'bg-yellow-600/15 text-yellow-400' :
                      'bg-gray-600/15 text-gray-400'
                    }`}>{rec.status}</span>
                    {rec.status === 'ready' && (
                      <button
                        onClick={() => handleGenerate(rec)}
                        disabled={generating === rec.id}
                        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                      >
                        {generating === rec.id ? 'Generating...' : 'Generate Guide'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                      title="Delete recording"
                    >
                      ×
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
