'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { ScreenRecorder } from '@/components/recordings/screen-recorder';
import { dispatchWorkspaceCelebrate } from '@/lib/ui/workspace-celebrate';
import { useAuth } from '@/lib/auth/auth-context';
import { useWorkspaceBrand } from '@/components/layout/workspace-brand-context';

type Status = 'recording' | 'uploading' | 'generating' | 'upload-error' | 'generate-error' | 'done';

export default function NewRecordingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { preferredWorkspaceId, activeBrandKitId, recordingProjectId } = useWorkspaceBrand();
  const [status, setStatus] = useState<Status>('recording');
  const [progress, setProgress] = useState('');
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);

  const handleRecordingComplete = async (result: {
    blob: Blob;
    duration: number;
    clickEvents: Array<{ x: number; y: number; timestamp: number; button: string }>;
    hasVoiceover?: boolean;
  }) => {
    setStatus('uploading');
    setProgress('Uploading recording...');

    try {
      if (!result.blob || result.blob.size < 1) {
        setProgress('Recording is empty. Try recording again.');
        setStatus('upload-error');
        return;
      }
      const formData = new FormData();
      formData.append('video', result.blob, 'recording.webm');
      formData.append(
        'metadata',
        JSON.stringify({
          title: `Recording ${new Date().toLocaleString()}`,
          duration: result.duration,
          width: 1920,
          height: 1080,
          clickEvents: result.clickEvents,
          mouseEvents: [],
          hasVoiceover: result.hasVoiceover === true,
          ...(user?.id ? { userId: user.id } : {}),
          ...(preferredWorkspaceId ? { workspaceId: preferredWorkspaceId } : {}),
          ...(activeBrandKitId ? { brandKitId: activeBrandKitId } : {}),
          ...(recordingProjectId ? { projectId: recordingProjectId } : {}),
        })
      );

      const uploadRes = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setProgress(err.error || 'Upload failed');
        setStatus('upload-error');
        return;
      }

      const recording = await uploadRes.json();
      setSavedRecordingId(recording.id);

      setStatus('generating');
      setProgress('Generating guide from recording...');

      const generateRes = await fetch('/api/guides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: recording.id,
          title: `Guide: ${recording.title}`,
          projectId: recording.projectId,
          userId: recording.userId,
        }),
      });

      if (!generateRes.ok) {
        const err = await generateRes.json();
        setProgress(err.error || 'Guide generation failed');
        setStatus('generate-error');
        return;
      }

      const guide = await generateRes.json();
      setStatus('done');
      dispatchWorkspaceCelebrate();
      router.push(`/guides/${guide.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setProgress(message);
      setStatus(savedRecordingId ? 'generate-error' : 'upload-error');
    }
  };

  const handleRetryGenerate = async () => {
    if (!savedRecordingId) return;
    setStatus('generating');
    setProgress('Retrying guide generation...');

    try {
      const generateRes = await fetch('/api/guides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: savedRecordingId }),
      });

      if (!generateRes.ok) {
        const err = await generateRes.json();
        setProgress(err.error || 'Guide generation failed');
        setStatus('generate-error');
        return;
      }

      const guide = await generateRes.json();
      setStatus('done');
      dispatchWorkspaceCelebrate();
      router.push(`/guides/${guide.id}`);
    } catch (err) {
      setProgress(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('generate-error');
    }
  };

  return (
    <AppShell>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">New Recording</h2>
            <p className="text-gray-400 mt-1">Record your screen to auto-generate a step-by-step guide</p>
          </div>

          {status === 'recording' && (
            <ScreenRecorder
              onRecordingComplete={handleRecordingComplete}
              onCancel={() => router.push('/recordings')}
            />
          )}

          {(status === 'uploading' || status === 'generating') && (
            <div className="max-w-3xl mx-auto card p-16 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-gray-100 mb-2">
                {status === 'uploading' ? 'Uploading Recording...' : 'Generating Guide...'}
              </h3>
              <p className="text-gray-400">{progress}</p>
              {status === 'generating' && (
                <p className="text-gray-500 text-sm mt-4">
                  Extracting key frames from your recording. This may take a moment for longer videos.
                </p>
              )}
            </div>
          )}

          {status === 'upload-error' && (
            <div className="max-w-3xl mx-auto card p-12 text-center">
              <div className="flex justify-center mb-4">
                <IconTile icon={CircleAlert} size="xl" variant="danger" />
              </div>
              <h3 className="text-xl font-semibold text-red-400 mb-2">Upload Failed</h3>
              <p className="text-gray-400 mb-6">{progress}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => { setStatus('recording'); setProgress(''); }}
                  className="btn-primary"
                >
                  Try Again
                </button>
                <Link href="/recordings" className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
                  Go to Recordings
                </Link>
              </div>
            </div>
          )}

          {status === 'generate-error' && (
            <div className="max-w-3xl mx-auto card p-12 text-center">
              <div className="flex justify-center mb-4">
                <IconTile icon={CircleCheck} size="xl" variant="success" />
              </div>
              <h3 className="text-xl font-semibold text-green-400 mb-2">Recording Saved!</h3>
              <p className="text-gray-400 mb-2">Your recording was uploaded successfully.</p>
              <p className="text-yellow-400/80 text-sm mb-6">Guide generation had an issue: {progress}</p>
              <div className="flex gap-4 justify-center">
                <button onClick={handleRetryGenerate} className="btn-primary">
                  Retry Generate Guide
                </button>
                <Link href="/recordings" className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
                  Go to Recordings
                </Link>
              </div>
              <p className="text-gray-500 text-sm mt-6">
                You can also generate the guide later from the Recordings page.
              </p>
            </div>
          )}
        </div>
    </AppShell>
  );
}
