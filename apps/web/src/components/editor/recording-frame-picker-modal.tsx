'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface RecordingFramePickerModalProps {
  videoUrl: string;
  uploading: boolean;
  onCancel: () => void;
  onCaptured: (blob: Blob) => void;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FRAME_STEP_S = 1 / 30;

export function RecordingFramePickerModal({
  videoUrl,
  uploading,
  onCancel,
  onCaptured,
}: RecordingFramePickerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const seekingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setDuration(v.duration || 0);
      setReady(true);
      v.pause();
      setPlaying(false);
    };
    const onTimeUpdate = () => {
      if (!seekingRef.current) setCurrentTime(v.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      setError('Could not load recording video. The file may be missing or blocked by CORS.');
    };

    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  }, []);

  const stepFrame = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const next = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    v.currentTime = next;
    setCurrentTime(next);
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    seekingRef.current = true;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
    seekingRef.current = false;
  }, []);

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) {
      setError('Video has no frames to capture yet. Wait for it to load.');
      return;
    }

    v.pause();

    const grab = () => {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        setError('Could not create canvas context.');
        return;
      }
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      } catch {
        setError('Could not read frame — the video may be blocked by CORS. Try downloading it and uploading as a file instead.');
        return;
      }
      canvas.toBlob((blob) => {
        if (blob) {
          onCaptured(blob);
        } else {
          setError('Failed to encode frame as PNG.');
        }
      }, 'image/png');
    };

    const rvfc = (
      v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: VideoFrameRequestCallback) => number }
    ).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      rvfc.call(v, () => requestAnimationFrame(grab));
    } else {
      requestAnimationFrame(grab);
    }
  }, [onCaptured]);

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm"
        aria-label="Close frame picker"
        onClick={() => !uploading && onCancel()}
      />
      <div
        className="relative z-10 w-full max-w-5xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Grab frame from recording</h3>
        <p className="text-sm text-gray-400 mb-4">
          Play or scrub to the moment you want, then click <strong className="text-gray-300">Use this frame</strong> to
          set it as the screenshot for this step.
        </p>

        <div className="rounded-lg overflow-hidden bg-black border border-gray-800 flex items-center justify-center min-h-[200px]">
          <video
            ref={videoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            className="max-h-[55vh] w-auto max-w-full"
            muted
            playsInline
            preload="auto"
          />
        </div>

        {ready && (
          <div className="mt-3 space-y-2">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.001}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-2 accent-brand-500 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepFrame(-FRAME_STEP_S)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  title="Back one frame"
                >
                  <SkipBack className="w-4 h-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  title={playing ? 'Pause' : 'Play'}
                >
                  {playing
                    ? <Pause className="w-5 h-5" strokeWidth={2} />
                    : <Play className="w-5 h-5" strokeWidth={2} />}
                </button>
                <button
                  type="button"
                  onClick={() => stepFrame(FRAME_STEP_S)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  title="Forward one frame"
                >
                  <SkipForward className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <span className="text-xs tabular-nums text-gray-500">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </div>
          </div>
        )}

        {!ready && !error && (
          <p className="text-xs text-amber-400/90 mt-2">Loading video…</p>
        )}
        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary px-4 py-2 disabled:opacity-50"
            onClick={captureFrame}
            disabled={uploading || !ready}
          >
            {uploading ? 'Uploading…' : 'Use this frame'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
