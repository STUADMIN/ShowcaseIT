'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Mic, MonitorPlay } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
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
  /** True when the WebM includes a microphone track (voiceover). */
  hasVoiceover: boolean;
}

interface ScreenRecorderProps {
  onRecordingComplete: (result: RecordingResult) => void;
  onCancel: () => void;
  /**
   * When true, user can enable microphone voiceover in the recording.
   * Guide-oriented flows should leave this false (default). Use `/recordings/video` for voice.
   */
  allowVoiceover?: boolean;
  /** Label for the primary action on the preview step (after recording). */
  saveButtonLabel?: string;
}

const MIC_PREF_KEY = 'showcaseit-recording-mic-enabled';

function pickRecorderMimeType(includeAudio: boolean): string {
  const withAudio = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const videoOnly = ['video/webm;codecs=vp9', 'video/webm'];
  const list = includeAudio ? withAudio : videoOnly;
  for (const c of list) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function ScreenRecorder({
  onRecordingComplete,
  onCancel,
  allowVoiceover = false,
  saveButtonLabel = 'Save & Generate Guide',
}: ScreenRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markerCount, setMarkerCount] = useState(0);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micActiveThisSession, setMicActiveThisSession] = useState(false);
  /** On guide-only pages: which idle path the user chose (segmented control). */
  const [idleCaptureMode, setIdleCaptureMode] = useState<'guide' | 'voice'>('guide');

  useEffect(() => {
    if (!allowVoiceover) {
      setMicEnabled(false);
      return;
    }
    try {
      const v = localStorage.getItem(MIC_PREF_KEY);
      if (v === '1') setMicEnabled(true);
      if (v === '0') setMicEnabled(false);
    } catch {
      /* ignore */
    }
  }, [allowVoiceover]);

  const setMicEnabledPersist = useCallback(
    (on: boolean) => {
      if (!allowVoiceover) return;
      setMicEnabled(on);
      try {
        localStorage.setItem(MIC_PREF_KEY, on ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    [allowVoiceover]
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Mic-only stream when combined with screen (so we can stop mic if display ends first). */
  const micStreamRef = useRef<MediaStream | null>(null);
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
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);
    setMicActiveThisSession(false);
    micStreamRef.current = null;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });

      let recordStream: MediaStream = displayStream;
      let voiceover = false;

      if (allowVoiceover && micEnabled) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          micStreamRef.current = micStream;
          recordStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...micStream.getAudioTracks(),
          ]);
          voiceover = true;
          setMicActiveThisSession(true);
        } catch (micErr) {
          console.warn('[ScreenRecorder] Microphone not available:', micErr);
          setError(
            'Microphone was blocked or unavailable — recording screen only. Allow mic access or turn off Voiceover and try again.'
          );
          recordStream = displayStream;
        }
      }

      streamRef.current = recordStream;
      chunksRef.current = [];
      clickEventsRef.current = [];
      setMarkerCount(0);
      startTimeRef.current = Date.now();

      const mimeType = pickRecorderMimeType(voiceover);
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(recordStream, recorderOptions);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);

        // Ensure the final screen becomes a step: WebM duration metadata is often short vs wall clock.
        let clickEvents = [...clickEventsRef.current];
        const lastTs =
          clickEvents.length > 0
            ? Math.max(...clickEvents.map((e) => e.timestamp))
            : -1;
        if (duration - lastTs > 1500) {
          clickEvents.push({
            x: 0,
            y: 0,
            timestamp: Math.max(0, duration - 80),
            button: 'step-marker',
          });
          clickEventsRef.current = clickEvents;
          setMarkerCount((c) => c + 1);
        }

        resultRef.current = {
          blob,
          duration,
          clickEvents,
          hasVoiceover: voiceover,
        };

        setPreviewUrl(url);
        setState('preview');
        if (timerRef.current) clearInterval(timerRef.current);
      };

      // If the user stops sharing via the browser UI, handle it
      const vTrack = recordStream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        };
      }

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
      streamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
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
    setMicActiveThisSession(false);
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
          <div className="flex justify-center mb-6">
            <IconTile icon={MonitorPlay} size="xl" variant="brand" />
          </div>
          <h3 className="text-2xl font-bold text-gray-100 mb-3">Record Your Screen</h3>

          {!allowVoiceover && (
            <div className="mb-6 max-w-xl mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">What are you recording?</p>
              <div
                className="flex rounded-xl border border-gray-700 p-1 bg-gray-900/90 shadow-inner"
                role="tablist"
                aria-label="Recording type"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={idleCaptureMode === 'guide'}
                  onClick={() => setIdleCaptureMode('guide')}
                  className={`flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-lg text-sm font-semibold transition-all ${
                    idleCaptureMode === 'guide'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
                  }`}
                >
                  Step-by-step guide
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={idleCaptureMode === 'voice'}
                  onClick={() => setIdleCaptureMode('voice')}
                  className={`flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 ${
                    idleCaptureMode === 'voice'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
                  }`}
                >
                  <Mic className="w-4 h-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  <span className="truncate">Video + voice</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {idleCaptureMode === 'guide'
                  ? 'Screen only — your browser won’t ask for a microphone here.'
                  : 'Opens the voice recording flow: save to your library with an optional mic toggle.'}
              </p>
            </div>
          )}

          {idleCaptureMode === 'guide' || allowVoiceover ? (
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Start recording, then use <strong className="text-gray-200">Mark step</strong> after each screen you want
              in the guide. If you only mark a few times on a long clip, we still add timeline screenshots (~every 8–9s) so
              you don’t end up with just 2–3 steps—remove extras in the editor if needed.
            </p>
          ) : (
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Continue to the <strong className="text-gray-200">video</strong> recorder. There you can turn on{' '}
              <strong className="text-gray-200">Voiceover</strong> before you start, then save to your recordings library
              (this path does not auto-generate a guide).
            </p>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {allowVoiceover ? (
            <div
              data-skip-click-ripple
              role="switch"
              tabIndex={0}
              aria-checked={micEnabled}
              onClick={() => setMicEnabledPersist(!micEnabled)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMicEnabledPersist(!micEnabled);
                }
              }}
              className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-3 p-4 rounded-xl bg-gray-800/40 border border-gray-700/80 max-w-md mx-auto cursor-pointer hover:border-gray-600 transition-colors text-left"
            >
              <span
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors pointer-events-none ${
                  micEnabled ? 'bg-brand-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    micEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
              <span className="pointer-events-none">
                <span className="block text-sm font-medium text-gray-200">Voiceover (microphone)</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Narrate while recording. Your choice is remembered on this device.
                </span>
              </span>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {!allowVoiceover && idleCaptureMode === 'voice' ? (
              <>
                <Link
                  href="/recordings/video"
                  className="btn-primary text-lg px-8 py-3 inline-flex items-center justify-center gap-2 w-full sm:w-auto min-w-[240px]"
                >
                  <Mic className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden />
                  Continue to voice recording
                </Link>
                <button
                  type="button"
                  onClick={() => setIdleCaptureMode('guide')}
                  className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors w-full sm:w-auto"
                >
                  Back to guide recording
                </button>
              </>
            ) : (
              <>
                <button onClick={startRecording} className="btn-primary text-lg px-8 py-3">
                  Start Recording
                </button>
                <button
                  onClick={onCancel}
                  className="px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {(allowVoiceover || idleCaptureMode === 'guide') && (
            <div className="mt-8 p-4 rounded-lg bg-gray-800/50 text-left text-sm text-gray-400 space-y-2">
              <p className="font-medium text-gray-300">Tips for a great recording:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Choose to share a specific window or your entire screen</li>
                <li>
                  After scrolls, clicks, or when a modal opens, click <strong className="text-gray-300">Mark step</strong>{' '}
                  (or press <kbd className="px-1 bg-gray-700 rounded text-xs">M</kbd> with this tab focused)
                </li>
                <li>
                  With <strong className="text-gray-300">no</strong> markers, the guide samples the video automatically;
                  with <strong className="text-gray-300">few</strong> markers on a long recording, extra timeline shots are
                  added so flows like login → pages → logout aren’t missing
                </li>
                <li>Pause briefly after each action so the frozen frame is clear</li>
                <li>Stop sharing when you're done (or click Stop below)</li>
                {allowVoiceover ? (
                  <li>
                    Turn on <strong className="text-gray-300">Voiceover</strong> above to mix your mic with the screen
                    capture (playback only — not used for guide steps)
                  </li>
                ) : (
                  <li>
                    Need <strong className="text-gray-300">voice</strong>? Select <strong className="text-gray-300">Video + voice</strong> above, then use{' '}
                    <strong className="text-gray-300">Continue to voice recording</strong>.
                  </li>
                )}
              </ul>
            </div>
          )}
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

          <div className="text-xs text-gray-500 space-y-1">
            <p>Markers recorded: {markerCount}</p>
            {allowVoiceover && micActiveThisSession && (
              <p className="text-brand-400/90 flex items-center justify-center gap-1.5">
                <Mic className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Microphone on — voiceover is being captured
              </p>
            )}
          </div>
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
            {resultRef.current?.hasVoiceover ? (
              <span className="text-brand-400/90 w-full sm:w-auto inline-flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Voiceover included — use the video player to listen
              </span>
            ) : null}
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
              {saveButtonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
