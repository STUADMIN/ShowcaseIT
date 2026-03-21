'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  showClickTargetRipple,
  showClickTargetRippleViewportCenter,
} from '@/lib/ui/click-target-ripple';

/** Browser recordings cannot see clicks on other windows; use `step-marker` via the Mark step control. */
interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
  button: string;
}

interface RecordingResult {
  blob: Blob;
  duration: number;
  clickEvents: ClickEvent[];
}

interface ScreenRecorderProps {
  onRecordingComplete: (result: RecordingResult) => void;
  onCancel: () => void;
}

export function ScreenRecorder({ onRecordingComplete, onCancel }: ScreenRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markerCount, setMarkerCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const clickEventsRef = useRef<ClickEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<RecordingResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const pushStepMarker = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'recording') return;
    const ts = Date.now() - startTimeRef.current;
    clickEventsRef.current.push({
      x: 0,
      y: 0,
      timestamp: ts,
      button: 'step-marker',
    });
    setMarkerCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (state !== 'recording') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'm' || e.key === 'M') {
        if (!e.repeat) {
          e.preventDefault();
          pushStepMarker();
          showClickTargetRippleViewportCenter();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [state, pushStepMarker]);

  /** Ripples on this page only — shared screen clicks are invisible to the browser. */
  useEffect(() => {
    if (state !== 'recording') return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-skip-click-ripple]')) return;
      showClickTargetRipple(e.clientX, e.clientY);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [state]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });

      streamRef.current = stream;
      chunksRef.current = [];
      clickEventsRef.current = [];
      setMarkerCount(0);
      startTimeRef.current = Date.now();

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        resultRef.current = {
          blob,
          duration,
          clickEvents: clickEventsRef.current,
        };

        setPreviewUrl(url);
        setState('preview');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      // If the user stops sharing via the browser UI, handle it
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 200);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Screen sharing was cancelled. Click "Start Recording" to try again.');
      } else {
        setError(`Failed to start recording: ${err}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const handleSave = () => {
    if (resultRef.current) {
      onRecordingComplete(resultRef.current);
    }
  };

  const handleRetry = () => {
    cleanup();
    setPreviewUrl(null);
    resultRef.current = null;
    setState('idle');
    setElapsed(0);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {state === 'idle' && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-6">🎬</div>
          <h3 className="text-2xl font-bold text-gray-100 mb-3">Record Your Screen</h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Start recording, then use <strong className="text-gray-200">Mark step</strong> after each action you want
            in the guide. Only marked moments become screenshots (not the whole timeline).
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button onClick={startRecording} className="btn-primary text-lg px-8 py-3">
              Start Recording
            </button>
            <button onClick={onCancel} className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
              Cancel
            </button>
          </div>

            <div className="mt-8 p-4 rounded-lg bg-gray-800/50 text-left text-sm text-gray-400 space-y-2">
            <p className="font-medium text-gray-300">Tips for a great recording:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Choose to share a specific window or your entire screen</li>
              <li>
                After scrolls, clicks, or when a modal opens, click <strong className="text-gray-300">Mark step</strong>{' '}
                (or press <kbd className="px-1 bg-gray-700 rounded text-xs">M</kbd> with this tab focused)
              </li>
              <li>Auto mode without markers guesses from video only — it cannot know your intent like a real click tracker</li>
              <li>Pause briefly after each action so the frozen frame is clear</li>
              <li>Stop sharing when you're done (or click Stop below)</li>
            </ul>
          </div>
        </div>
      )}

      {state === 'recording' && (
        <div className="card p-12 text-center relative">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-4xl font-mono font-bold text-white">{formatTime(elapsed)}</span>
          </div>

          <p className="text-gray-400 mb-4">
            After each action on the screen you’re sharing, click <strong className="text-gray-200">Mark step</strong> below
            (or focus this tab and press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 text-xs">M</kbd>
            ). That records a screenshot moment—only marked steps become guide screens (not every second of video).
          </p>

          <p className="text-sm text-amber-200/90 mb-6 max-w-lg mx-auto">
            Browsers can’t see clicks, scrolls, or modals on the screen you’re sharing — only this tab can record
            “Mark step”. Press it after each important view: scroll stops, button clicks, dialogs opening, page changes.
          </p>

          <div className="flex flex-wrap gap-3 justify-center items-center mb-8">
            <button
              type="button"
              onClick={pushStepMarker}
              className="px-8 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg transition-colors shadow-lg shadow-brand-900/40"
            >
              Mark step
            </button>
            <button
              type="button"
              data-skip-click-ripple
              onClick={stopRecording}
              className="px-8 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-lg transition-colors"
            >
              Stop Recording
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Markers recorded: {markerCount}
          </p>
        </div>
      )}

      {state === 'preview' && previewUrl && (
        <div className="card p-8">
          <h3 className="text-xl font-semibold text-gray-100 mb-4">Review Your Recording</h3>

          <div className="rounded-lg overflow-hidden bg-black mb-6">
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              className="w-full max-h-[400px]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400 mb-6">
            <span>Duration: {formatTime(resultRef.current?.duration || 0)}</span>
            <span>Step markers: {resultRef.current?.clickEvents.length ?? 0}</span>
            <span>Size: {((resultRef.current?.blob.size || 0) / 1024 / 1024).toFixed(1)} MB</span>
          </div>

          {(resultRef.current?.clickEvents.length ?? 0) === 0 && (
            <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-100/95 text-sm text-left">
              <p className="font-medium text-amber-200 mb-1">No step markers in this recording</p>
              <p className="text-amber-100/80">
                The guide will use <strong>automatic screenshots</strong> from the video. That cannot detect your clicks or
                scrolls on the shared window — use <strong>Re-record</strong> and <strong>Mark step</strong> after each
                screen you care about, or the <strong>desktop app</strong> for real click capture.
              </p>
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <button onClick={handleRetry} className="px-6 py-2.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
              Re-record
            </button>
            <button onClick={handleSave} className="btn-primary px-8 py-2.5">
              Save & Generate Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
