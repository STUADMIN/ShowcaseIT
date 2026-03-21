'use client';

import { useState, useRef, useCallback } from 'react';

interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
}

interface Annotation {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
}

interface StepPreviewProps {
  step: {
    id: string;
    order: number;
    title: string;
    description: string;
    screenshotUrl: string;
    annotations: Annotation[];
    blurRegions: BlurRegion[];
  };
  onUpdate: (updates: Record<string, unknown>) => void;
  activeTool?: string;
}

export function StepPreview({ step, onUpdate, activeTool }: StepPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleScreenshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setUploadError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/guide-steps/${step.id}/screenshot`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = (await res.json()) as { screenshotUrl?: string | null };
      if (data.screenshotUrl) {
        onUpdate({ screenshotUrl: data.screenshotUrl });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState({ x: 0, y: 0 });

  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'blur') return;
    const pos = getRelativePosition(e);
    setDrawStart(pos);
    setDrawCurrent(pos);
    setDrawing(true);
  }, [activeTool, getRelativePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    setDrawCurrent(getRelativePosition(e));
  }, [drawing, getRelativePosition]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    if (width < 1 || height < 1) return;

    const newRegion: BlurRegion = {
      id: `blur-${Date.now()}`,
      x, y, width, height,
      intensity: 20,
    };

    onUpdate({ blurRegions: [...step.blurRegions, newRegion] });
  }, [drawing, drawStart, drawCurrent, step.blurRegions, onUpdate]);

  const removeBlurRegion = (regionId: string) => {
    onUpdate({ blurRegions: step.blurRegions.filter((r) => r.id !== regionId) });
  };

  const drawRect = drawing ? {
    x: Math.min(drawStart.x, drawCurrent.x),
    y: Math.min(drawStart.y, drawCurrent.y),
    width: Math.abs(drawCurrent.x - drawStart.x),
    height: Math.abs(drawCurrent.y - drawStart.y),
  } : null;

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
            {step.order}
          </span>
          <h2 className="text-xl font-bold text-gray-100">{step.title}</h2>
        </div>
        <p className="text-gray-400 ml-11">{step.description}</p>
      </div>

      <div
        ref={containerRef}
        className={`relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden ${
          activeTool === 'blur' ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => drawing && handleMouseUp()}
      >
        {step.screenshotUrl ? (
          <div className="relative select-none">
            <img
              src={step.screenshotUrl}
              alt={step.title}
              className="w-full"
              draggable={false}
            />
            {step.blurRegions.map((region) => (
              <div
                key={region.id}
                className="absolute backdrop-blur-xl bg-gray-900/30 group"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); removeBlurRegion(region.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs items-center justify-center hidden group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
            {step.annotations.map((ann) => (
              <div
                key={ann.id}
                className="absolute"
                style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
              >
                {ann.type === 'badge' && (
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shadow-lg">
                    {ann.text || '!'}
                  </span>
                )}
                {ann.type === 'callout' && (
                  <div className="bg-gray-900/90 border border-brand-600 rounded-lg px-3 py-1.5 text-sm text-white shadow-lg max-w-xs">
                    {ann.text}
                  </div>
                )}
                {ann.type === 'highlight' && (
                  <div
                    className="border-2 border-yellow-400 bg-yellow-400/10 rounded"
                    style={{
                      width: `${ann.width || 10}%`,
                      height: `${ann.height || 5}%`,
                    }}
                  />
                )}
              </div>
            ))}
            {drawRect && (
              <div
                className="absolute border-2 border-dashed border-red-400 bg-red-400/10"
                style={{
                  left: `${drawRect.x}%`,
                  top: `${drawRect.y}%`,
                  width: `${drawRect.width}%`,
                  height: `${drawRect.height}%`,
                }}
              />
            )}
          </div>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center text-gray-600 p-12 gap-4">
            <div className="text-5xl mb-2">🖼</div>
            <p className="text-lg font-medium">No screenshot</p>
            <p className="text-sm mt-1 text-center max-w-sm">
              Add an image for this step, or use a screen recording / desktop app to auto-fill frames.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleScreenshotFile}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              {uploading ? 'Uploading…' : 'Upload screenshot'}
            </button>
            {uploadError && <p className="text-xs text-red-400 text-center max-w-sm">{uploadError}</p>}
          </div>
        )}
      </div>

      {step.screenshotUrl ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleScreenshotFile}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-brand-400 hover:text-brand-300 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Replace screenshot'}
          </button>
          {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
        </div>
      ) : null}

      {step.blurRegions.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {step.blurRegions.length} blur region(s) — hover to remove
        </p>
      )}
    </div>
  );
}
