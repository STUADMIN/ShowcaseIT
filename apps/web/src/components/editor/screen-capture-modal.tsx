'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

interface ScreenCaptureModalProps {
  stream: MediaStream;
  uploading: boolean;
  onCancel: () => void;
  /** Called with a PNG blob of the current video frame. */
  onCaptured: (blob: Blob) => void;
  /** Shown when the frame cannot be read (e.g. clicked Save before the stream is ready). */
  onCaptureFailed?: (message: string) => void;
}

function waitForNextPaint(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

export function ScreenCaptureModal({
  stream,
  uploading,
  onCancel,
  onCaptured,
  onCaptureFailed,
}: ScreenCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewReady, setPreviewReady] = useState(false);
  /** Some browsers/OS combos never fire dimensions; still allow Save after a short wait. */
  const [saveUnlocked, setSaveUnlocked] = useState(false);

  useEffect(() => {
    setPreviewReady(false);
    setSaveUnlocked(false);
    const v = videoRef.current;
    if (!v) return;

    const markReady = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setPreviewReady(true);
      }
    };

    v.srcObject = stream;
    v.addEventListener('loadedmetadata', markReady);
    v.addEventListener('loadeddata', markReady);
    v.addEventListener('canplay', markReady);
    v.addEventListener('resize', markReady);
    v.addEventListener('playing', markReady);
    v.addEventListener('timeupdate', markReady);
    void v.play()
      .then(() => waitForNextPaint(markReady))
      .catch(() => {});
    waitForNextPaint(markReady);

    const unlock = window.setTimeout(() => setSaveUnlocked(true), 2800);

    return () => {
      window.clearTimeout(unlock);
      v.removeEventListener('loadedmetadata', markReady);
      v.removeEventListener('loadeddata', markReady);
      v.removeEventListener('canplay', markReady);
      v.removeEventListener('resize', markReady);
      v.removeEventListener('playing', markReady);
      v.removeEventListener('timeupdate', markReady);
      /** Detach only — do not stop tracks here. Stopping in this cleanup breaks capture under React Strict Mode
       *  (effect re-runs and would end the stream before the user saves) and should be done when closing the modal. */
      v.srcObject = null;
    };
  }, [stream]);

  const drawFrameToBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const v = videoRef.current;
      if (!v) {
        resolve(null);
        return;
      }
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) {
        resolve(null);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        resolve(null);
        return;
      }
      try {
        ctx.drawImage(v, 0, 0, w, h);
      } catch {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }, []);

  const saveFrame = () => {
    const v = videoRef.current;
    const fail = (msg: string) => onCaptureFailed?.(msg);

    if (!v) {
      fail('Video preview is not ready.');
      return;
    }
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      fail('Wait until the shared screen appears in the preview, then try again.');
      return;
    }
    if (!v.videoWidth || !v.videoHeight) {
      fail('Stream has no video size yet — wait a moment, then try again.');
      return;
    }

    const finish = () => {
      void drawFrameToBlob().then((blob) => {
        if (blob) {
          onCaptured(blob);
          return;
        }
        fail(
          'Could not grab a frame. Wait until the preview shows your content, or try sharing a window instead of a tab.'
        );
      });
    };

    /** Prefer a decoded frame — avoids all-black PNGs when Save is clicked too early (Chrome tab/window capture). */
    const rvfc = (
      v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: VideoFrameRequestCallback) => number }
    ).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      rvfc.call(v, () => waitForNextPaint(finish));
    } else {
      waitForNextPaint(finish);
    }
  };

  const saveEnabled = previewReady || saveUnlocked;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm"
        aria-label="Close capture"
        onClick={() => !uploading && onCancel()}
      />
      <div
        className="relative z-10 w-full max-w-4xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Screenshot for this step</h3>
        <p className="text-sm text-gray-400 mb-4">
          The browser will ask which screen, window, or tab to share — that becomes a <strong className="text-gray-300">single</strong>{' '}
          still image for <strong className="text-gray-300">this step only</strong> (not a video). After you click{' '}
          <strong className="text-gray-300">Share</strong>, <strong className="text-gray-300">come back to this tab</strong>, check the
          preview below, then click <strong className="text-gray-300">Use this screenshot</strong>. For many auto-generated steps, use{' '}
          <Link href="/recordings/new" className="text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline">
            New recording
          </Link>
          .
        </p>
        <div className="rounded-lg overflow-hidden bg-black border border-gray-800 flex items-center justify-center min-h-[200px]">
          <video ref={videoRef} className="max-h-[55vh] w-auto max-w-full" muted playsInline autoPlay />
        </div>
        {!previewReady && !uploading && !saveUnlocked ? (
          <p className="text-xs text-amber-400/90 mt-2">Connecting to shared source…</p>
        ) : null}
        {!previewReady && saveUnlocked && !uploading ? (
          <p className="text-xs text-amber-400/90 mt-2">
            Preview still blank? You can try Use this screenshot anyway, or pick a different share target (e.g. entire screen).
          </p>
        ) : null}
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
            onClick={saveFrame}
            disabled={uploading || !saveEnabled}
            title={!saveEnabled ? 'Wait a moment for the preview, or until the button unlocks' : undefined}
          >
            {uploading ? 'Uploading…' : 'Use this screenshot'}
          </button>
        </div>
      </div>
    </div>
  );
}
