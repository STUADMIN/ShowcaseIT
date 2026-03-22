'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getIceServers } from '@/lib/cast/ice-servers';
import { CAST_BROADCAST_EVENT, type CastSignalPayload } from '@/lib/cast/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function CastSenderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = (params?.sessionId as string) || '';
  /** Guide cast adds `?voice=0` so the phone does not offer tab/system audio. */
  const includeTabAudio = searchParams.get('voice') !== '0';
  const [hostSeen, setHostSeen] = useState(false);
  const [status, setStatus] = useState<string>('Connecting…');
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingReceiverIce = useRef<RTCIceCandidateInit[]>([]);

  const sendSignal = useCallback(
    (payload: CastSignalPayload) => {
      const ch = channelRef.current;
      if (!ch) return;
      void ch.send({ type: 'broadcast', event: CAST_BROADCAST_EVENT, payload });
    },
    []
  );

  const flushReceiverIce = useCallback(async (pc: RTCPeerConnection) => {
    const list = pendingReceiverIce.current;
    pendingReceiverIce.current = [];
    for (const c of list) {
      await pc.addIceCandidate(c).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    pendingReceiverIce.current = [];
    const supabase = createClient();
    const channelName = `cast_${sessionId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'broadcast',
        { event: CAST_BROADCAST_EVENT },
        async ({ payload }) => {
          const msg = payload as CastSignalPayload;
          if (msg.type === 'host-online') {
            setHostSeen(true);
            setStatus('Computer is ready — tap Share screen below.');
            return;
          }
          if (msg.type === 'answer' && pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
              await flushReceiverIce(pcRef.current);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to apply answer');
            }
            return;
          }
          if (msg.type === 'ice' && msg.from === 'receiver' && msg.candidate) {
            const pc = pcRef.current;
            if (!pc?.remoteDescription) {
              pendingReceiverIce.current.push(msg.candidate);
              return;
            }
            await pc.addIceCandidate(msg.candidate).catch(() => {});
          }
        }
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('Waiting for ShowcaseIt on your computer…');
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setError(
            'Could not join cast channel. Check that Realtime is enabled in Supabase and try again.'
          );
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [sessionId, flushReceiverIce]);

  const startShare = async () => {
    if (!hostSeen) {
      setError('Open the Record from phone page on your computer first (QR link).');
      return;
    }
    setError(null);
    setStatus('Choose what to share…');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: includeTabAudio,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setError('Screen share was cancelled.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not start screen share');
      }
      setStatus('Tap Share screen to try again.');
      return;
    }

    localStreamRef.current = stream;
    setSharing(true);
    setStatus('Connecting to your computer…');

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      setStatus('Sharing stopped.');
      setSharing(false);
      pc.close();
      pcRef.current = null;
    });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal({
          type: 'ice',
          from: 'sender',
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        setStatus('Connected — keep this page open. Recording happens on the computer.');
      }
      if (st === 'failed' || st === 'disconnected') {
        setError(
          'Connection lost. Same Wi‑Fi helps; strict networks may need a TURN server (see docs).'
        );
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'offer', sdp: pc.localDescription?.sdp || offer.sdp || '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create connection');
      setSharing(false);
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  return (
    <div className="min-h-dvh bg-[#0a0c10] text-gray-100 flex flex-col items-center justify-center p-6 safe-area-pb">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">ShowcaseIt</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Cast your phone or tablet screen to ShowcaseIt on your computer. Recording and guide generation happen on the
          desktop — keep this tab open while you use your device.
        </p>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 text-sm text-gray-300">{status}</div>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        )}
        <button
          type="button"
          disabled={!hostSeen || sharing}
          onClick={() => void startShare()}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold text-base"
        >
          {sharing ? 'Sharing…' : 'Share screen'}
        </button>
        <p className="text-xs text-gray-500">
          iOS: Safari may limit what can be shared. Android: Chrome usually works best. Use the same Wi‑Fi as your
          computer when possible.
        </p>
      </div>
    </div>
  );
}
