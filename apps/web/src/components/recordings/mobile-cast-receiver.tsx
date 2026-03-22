'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getIceServers } from '@/lib/cast/ice-servers';
import { CAST_BROADCAST_EVENT, type CastSignalPayload } from '@/lib/cast/types';
import { showClickTargetRipple, showClickTargetRippleViewportCenter } from '@/lib/ui/click-target-ripple';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Same-origin API renders the QR (no third-party image service). */
function castQrImageSrc(url: string): string {
  return `/api/cast/qr?url=${encodeURIComponent(url)}`;
}

export interface MobileCastRecordingResult {
  blob: Blob;
  duration: number;
  clickEvents: Array<{ x: number; y: number; timestamp: number; button: string }>;
  hasVoiceover: boolean;
  videoWidth: number;
  videoHeight: number;
}

interface MobileCastReceiverProps {
  onRecordingComplete: (result: MobileCastRecordingResult) => void;
  onCancel: () => void;
  /**
   * When false (default), only video tracks are muxed — no mic/tab audio in the file (guide flow).
   */
  allowVoiceover?: boolean;
}

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

const ENV_CAST_BASE = process.env.NEXT_PUBLIC_CAST_BASE_URL?.trim();

export function MobileCastReceiver({
  onRecordingComplete,
  onCancel,
  allowVoiceover = false,
}: MobileCastReceiverProps) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [linkStatus, setLinkStatus] = useState<string>('Setting up…');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<'qr' | 'preview' | 'recording' | 'error'>('qr');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [markerCount, setMarkerCount] = useState(0);
  const [qrFailed, setQrFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingSenderIce = useRef<RTCIceCandidateInit[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const clickEventsRef = useRef<MobileCastRecordingResult['clickEvents']>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendSignalRef = useRef<(p: CastSignalPayload) => void>(() => {});

  const castBase = useMemo(() => {
    const env = ENV_CAST_BASE?.replace(/\/$/, '');
    if (env) return env;
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const castUrl = useMemo(() => {
    if (!castBase) return '';
    const u = new URL(`${castBase}/cast/s/${sessionId}`);
    if (!allowVoiceover) u.searchParams.set('voice', '0');
    return u.toString();
  }, [castBase, sessionId, allowVoiceover]);

  useEffect(() => {
    setQrFailed(false);
  }, [sessionId]);

  const flushSenderIce = useCallback(async (pc: RTCPeerConnection) => {
    const list = pendingSenderIce.current;
    pendingSenderIce.current = [];
    for (const c of list) {
      await pc.addIceCandidate(c).catch(() => {});
    }
  }, []);

  const teardownPeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingSenderIce.current = [];
    setRemoteStream(null);
  }, []);

  const handleOffer = useCallback(
    async (sdp: string) => {
      teardownPeer();
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (stream) {
          setRemoteStream(stream);
          setPhase('preview');
          setLinkStatus('Phone connected — start recording when ready.');
        }
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignalRef.current({
            type: 'ice',
            from: 'receiver',
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError(
            'WebRTC failed. Try same Wi‑Fi, or configure NEXT_PUBLIC_TURN_URL for your network.'
          );
          setPhase('error');
        }
      };

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp });
        await flushSenderIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignalRef.current({
          type: 'answer',
          sdp: pc.localDescription?.sdp || answer.sdp || '',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to answer phone');
        setPhase('error');
        teardownPeer();
      }
    },
    [flushSenderIce, teardownPeer]
  );

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!sessionId) return;

    setLinkStatus('Connecting to signaling…');
    setError(null);
    setPhase('qr');
    teardownPeer();

    const supabase = createClient();
    const channelName = `cast_${sessionId}`;

    const sendSignal = (payload: CastSignalPayload) => {
      const ch = channelRef.current;
      if (!ch) return;
      void ch.send({ type: 'broadcast', event: CAST_BROADCAST_EVENT, payload });
    };
    sendSignalRef.current = sendSignal;

    const channel = supabase
      .channel(channelName)
      .on(
        'broadcast',
        { event: CAST_BROADCAST_EVENT },
        async ({ payload }) => {
          const msg = payload as CastSignalPayload;
          if (msg.type === 'ice' && msg.from === 'sender' && msg.candidate) {
            const pc = pcRef.current;
            if (!pc?.remoteDescription) {
              pendingSenderIce.current.push(msg.candidate);
              return;
            }
            await pc.addIceCandidate(msg.candidate).catch(() => {});
            return;
          }
          if (msg.type === 'offer') {
            await handleOffer(msg.sdp);
          }
        }
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setLinkStatus('Scan the QR code with your phone, then tap Share screen.');
          sendSignal({ type: 'host-online' });
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setError(
            'Realtime channel failed. In Supabase: enable Realtime, and allow anonymous broadcast for development.'
          );
          setPhase('error');
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
      teardownPeer();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current = null;
    };
  }, [sessionId, handleOffer, teardownPeer]);

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
    if (phase !== 'recording') return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-skip-click-ripple]')) return;
      showClickTargetRipple(e.clientX, e.clientY);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'recording') return;
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
  }, [phase, pushStepMarker]);

  const startRecording = useCallback(() => {
    if (!remoteStream) return;
    setError(null);
    chunksRef.current = [];
    clickEventsRef.current = [];
    setMarkerCount(0);
    startTimeRef.current = Date.now();

    const recordStream = allowVoiceover
      ? remoteStream
      : new MediaStream(remoteStream.getVideoTracks());
    const hasAudio = allowVoiceover && remoteStream.getAudioTracks().length > 0;
    const mimeType = pickRecorderMimeType(hasAudio);
    const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const duration = Date.now() - startTimeRef.current;
      let clickEvents = [...clickEventsRef.current];
      const lastTs =
        clickEvents.length > 0 ? Math.max(...clickEvents.map((e) => e.timestamp)) : -1;
      if (duration - lastTs > 1500) {
        clickEvents.push({
          x: 0,
          y: 0,
          timestamp: Math.max(0, duration - 80),
          button: 'step-marker',
        });
      }

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const vt = remoteStream.getVideoTracks()[0];
      const settings = vt?.getSettings?.() ?? {};
      const videoWidth = typeof settings.width === 'number' ? settings.width : 1280;
      const videoHeight = typeof settings.height === 'number' ? settings.height : 720;
      onRecordingComplete({
        blob,
        duration,
        clickEvents,
        hasVoiceover: hasAudio,
        videoWidth,
        videoHeight,
      });
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 200);
  }, [remoteStream, onRecordingComplete, allowVoiceover]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const newSession = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      stopRecording();
    }
    setSessionId(crypto.randomUUID());
    setPhase('qr');
    setError(null);
    setMarkerCount(0);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Record from phone</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            This is not AirPlay — your phone opens a link and uses the browser&apos;s{' '}
            <strong className="text-gray-300">screen share</strong> to send video to this tab (WebRTC). Same idea as a
            QR pairing code, but web-native.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={newSession}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm"
          >
            New QR code
          </button>
        </div>
      </div>

      {phase === 'error' && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="card p-6 flex flex-col items-center text-center space-y-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Scan with phone</p>
          {castUrl ? (
            <div className="p-4 bg-white rounded-xl">
              <img
                src={castQrImageSrc(castUrl)}
                width={220}
                height={220}
                alt="QR code to open cast link on your phone"
                className="block w-[220px] h-[220px] object-contain"
                onError={() => setQrFailed(true)}
              />
            </div>
          ) : (
            <div className="h-[232px] w-[232px] bg-gray-800 rounded-xl animate-pulse" />
          )}
          <p className="text-xs text-gray-500 break-all max-w-full">{castUrl}</p>
          {qrFailed ? (
            <p className="text-xs text-amber-200/90 max-w-sm">
              QR image failed to load. Open the cast URL above on your phone, or open this in a new tab to see the
              error:{' '}
              <span className="text-gray-400 break-all">{castQrImageSrc(castUrl)}</span>
            </p>
          ) : null}
          <p className="text-sm text-gray-400">{linkStatus}</p>
        </div>

        <div className="card p-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Preview (from phone)</p>
          <div
            className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center"
            data-skip-click-ripple
          >
            {remoteStream ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            ) : (
              <span className="text-gray-600 text-sm px-4 text-center">Waiting for phone stream…</span>
            )}
          </div>

          {phase === 'preview' && remoteStream && (
            <button type="button" onClick={startRecording} className="btn-primary w-full py-3 text-sm font-semibold">
              Start recording
            </button>
          )}

          {phase === 'recording' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-400 font-mono tabular-nums">● {formatTime(elapsed)}</span>
                <span className="text-gray-500">Markers: {markerCount}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={pushStepMarker}
                  className="flex-1 min-w-[120px] py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200"
                >
                  Mark step
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex-1 min-w-[120px] py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
                >
                  Stop
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Press <kbd className="px-1 rounded bg-gray-800">M</kbd> to mark a step (ripple on this screen only).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
