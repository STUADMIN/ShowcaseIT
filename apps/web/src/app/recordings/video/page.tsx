'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { ScreenRecorder } from '@/components/recordings/screen-recorder';

type Status = 'recording' | 'uploading' | 'upload-error';

/**
 * Saves a screen recording to the library only (no guide generation).
 * Voiceover is available here — guide flows use /recordings/new without mic.
 */
export default function NewVideoRecordingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('recording');
  const [progress, setProgress] = useState('');

  const handleRecordingComplete = async (result: {
    blob: Blob;
    duration: number;
    clickEvents: Array<{ x: number; y: number; timestamp: number; button: string }>;
    hasVoiceover?: boolean;
  }) => {
    setStatus('uploading');
    setProgress('Uploading recording...');

    try {
      const formData = new FormData();
      formData.append('video', result.blob, 'recording.webm');
      formData.append(
        'metadata',
        JSON.stringify({
          title: `Video ${new Date().toLocaleString()}`,
          duration: result.duration,
          width: 1920,
          height: 1080,
          clickEvents: result.clickEvents,
          mouseEvents: [],
          hasVoiceover: result.hasVoiceover === true,
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

      router.push('/recordings');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setProgress(message);
      setStatus('upload-error');
    }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Record a video</h2>
            <p className="text-gray-400 mt-1 max-w-xl">
              Saves to your recordings library for playback. Optional voiceover is recorded into the video file. For
              step-by-step guides (screenshots + steps), use{' '}
              <Link href="/recordings/new" className="text-brand-400 hover:text-brand-300">
                New Recording
              </Link>
              .
            </p>
          </div>
          <Link href="/recordings" className="text-sm text-gray-400 hover:text-gray-200 whitespace-nowrap">
            ← Back to recordings
          </Link>
        </div>

        {status === 'recording' && (
          <ScreenRecorder
            allowVoiceover
            saveButtonLabel="Save to Recordings"
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => router.push('/recordings')}
          />
        )}

        {status === 'uploading' && (
          <div className="max-w-3xl mx-auto card p-16 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">Uploading…</h3>
            <p className="text-gray-400">{progress}</p>
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
              <button type="button" onClick={() => { setStatus('recording'); setProgress(''); }} className="btn-primary">
                Try Again
              </button>
              <Link
                href="/recordings"
                className="px-6 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
              >
                Go to Recordings
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
