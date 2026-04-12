'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';

interface ImageCaptureApi {
  grabFrame(): Promise<ImageBitmap>;
}
declare const ImageCapture: {
  new (track: MediaStreamTrack): ImageCaptureApi;
};

interface CaptureSessionModalProps {
  stream: MediaStream;
  stepNumber: number;
  capturedCount: number;
  uploading: boolean;
  onCapture: (blob: Blob) => void;
  onDone: () => void;
}

const TARGET_W = 1440;
const TARGET_H = 900;

function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob | null> {
  return new Promise((resolve) => {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const srcAspect = srcW / srcH;
    const targetAspect = TARGET_W / TARGET_H;

    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (srcAspect > targetAspect) {
      sw = Math.round(srcH * targetAspect);
      sx = Math.round((srcW - sw) / 2);
    } else if (srcAspect < targetAspect) {
      sh = Math.round(srcW / targetAspect);
      sy = Math.round((srcH - sh) / 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { resolve(null); return; }
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
    bitmap.close();
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

export function CaptureSessionModal({
  stream,
  stepNumber,
  capturedCount,
  uploading,
  onCapture,
  onDone,
}: CaptureSessionModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const icRef = useRef<ImageCaptureApi | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const track = stream.getVideoTracks()[0];
    if (!track) {
      setError('No video track in stream.');
      return;
    }

    const ic = new ImageCapture(track);
    icRef.current = ic;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const bitmap = await ic.grabFrame();
          if (cancelled) { bitmap.close(); break; }
          if (bitmap.width > 0 && bitmap.height > 0) {
            const canvas = canvasRef.current;
            if (canvas) {
              if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
              }
              const ctx = canvas.getContext('2d');
              if (ctx) ctx.drawImage(bitmap, 0, 0);
            }
            bitmap.close();
            if (!previewReady) setPreviewReady(true);
            if (!captureReady) setCaptureReady(true);
          } else {
            bitmap.close();
          }
        } catch {
          if (cancelled) break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    void poll();
    const forceUnlock = setTimeout(() => setCaptureReady(true), 3000);

    return () => {
      cancelled = true;
      clearTimeout(forceUnlock);
      icRef.current = null;
    };
  }, [stream, previewReady, captureReady]);

  const captureFrame = useCallback(async () => {
    setError(null);
    const ic = icRef.current;
    if (!ic) {
      setError('No image capture available.');
      return;
    }
    try {
      const bitmap = await ic.grabFrame();
      if (!bitmap.width || !bitmap.height) {
        bitmap.close();
        setError('Grabbed an empty frame. Make sure the shared tab is still open.');
        return;
      }
      const blob = await bitmapToBlob(bitmap);
      if (blob) {
        onCaptureRef.current(blob);
      } else {
        setError('Could not encode frame.');
      }
    } catch (err) {
      setError('Capture failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-4xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">
              Capture screenshots — Step {stepNumber}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {capturedCount > 0
                ? `${capturedCount} step${capturedCount !== 1 ? 's' : ''} captured — switch to the shared tab, navigate, come back and capture again`
                : 'Switch to the shared tab, navigate to what you want, come back here and click Capture'}
            </p>
          </div>
          {capturedCount > 0 && (
            <span className="shrink-0 px-3 py-1 rounded-full bg-green-900/50 border border-green-700/50 text-green-400 text-xs font-medium">
              {capturedCount} captured
            </span>
          )}
        </div>

        <div className="rounded-lg overflow-hidden bg-black border border-gray-800 flex items-center justify-center min-h-[200px]">
          <canvas
            ref={canvasRef}
            className="max-h-[55vh] w-auto max-w-full"
            style={{ imageRendering: 'auto' }}
          />
          {!previewReady && (
            <span className="absolute text-sm text-gray-500">
              Preview appears when you switch back from the shared tab…
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        <p className="text-xs text-gray-600 mt-2">
          Each <strong className="text-gray-500">Capture</strong> saves a screenshot to the current step and creates the next one.
          Click <strong className="text-gray-500">Done</strong> when finished.
        </p>

        <div className="flex flex-wrap gap-3 justify-end mt-4">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            onClick={onDone}
            disabled={uploading}
          >
            Done
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-[0.97] disabled:opacity-50 text-white text-sm font-semibold transition-all"
            onClick={() => void captureFrame()}
            disabled={uploading || !captureReady}
          >
            <Camera className="w-4 h-4" strokeWidth={2.5} />
            {uploading ? 'Saving…' : `Capture (Step ${stepNumber})`}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
