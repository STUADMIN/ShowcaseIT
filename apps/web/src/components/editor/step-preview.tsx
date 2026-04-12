'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Camera, Film, ImageUp } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
import { TextAnnotationModal } from './text-annotation-modal';
import { RecordingFramePickerModal } from './recording-frame-picker-modal';
import { computeArrowParts } from '@/lib/editor/arrow-geometry';
import { cropImageToPngBlob } from '@/lib/editor/crop-image';
import {
  CIRCLE_OUTLINE_PRESETS,
  HIGHLIGHT_COLOR_PRESETS,
  circleFillRgba,
  resolveCircleStroke,
  resolveHighlightColor,
} from '@/lib/editor/circle-colors';
import {
  annotationWithDelta,
  blurRegionWithDelta,
  type LooseAnnotation,
  type LooseBlurRegion,
} from '@/lib/editor/drag-move';
import {
  type CalloutTailEdge,
  clampTailOffset,
  cycleCalloutTailEdge,
  defaultCalloutTail,
  parseCalloutTail,
  tailOffsetDeltaFromPointer,
} from '@/lib/editor/callout-tail';
import { CalloutTailVisual } from '@/components/editor/callout-tail-visual';
import {
  BLUR_INTENSITY_DEFAULT,
  blurOverlayAlpha,
  blurRadiusPx,
  clampBlurIntensity,
} from '@/lib/editor/blur-intensity';

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
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  calloutTailEdge?: string;
  calloutTailOffset?: number;
}

interface StepPreviewProps {
  step: {
    id: string;
    order: number;
    title: string;
    description: string;
    screenshotUrl: string;
    screenshotOriginalUrl?: string | null;
    annotations: Annotation[];
    blurRegions: BlurRegion[];
  };
  onUpdate: (updates: Record<string, unknown>) => void;
  activeTool?: string;
  /** Wider layout when editor is in focus mode */
  expandedCanvas?: boolean;
  /** Video URL from the guide's linked recording (null when no recording). */
  recordingVideoUrl?: string | null;
  /** Start a persistent capture session (managed by parent GuideEditor). */
  onStartCaptureSession?: () => void;
  /** True while a capture session is active (disables competing buttons). */
  captureSessionActive?: boolean;
}

const RECT_ANNOTATION_TOOLS = ['highlight', 'circle', 'box', 'callout'] as const;
type RectAnnTool = (typeof RECT_ANNOTATION_TOOLS)[number];

function isRectAnnotationTool(t: string): t is RectAnnTool {
  return (RECT_ANNOTATION_TOOLS as readonly string[]).includes(t);
}

/** Total time from releasing drag until the text modal opens (ms). */
const CALLOUT_TEXT_MODAL_DELAY_MS = 1550;
/** Last portion of that time: frame fades out before the modal appears (ms). */
const CALLOUT_PENDING_FADE_MS = 350;

function crosshairTool(t: string | undefined): boolean {
  if (!t) return false;
  return (
    t === 'blur' ||
    t === 'arrow' ||
    t === 'crop' ||
    isRectAnnotationTool(t) ||
    t === 'badge' ||
    t === 'text'
  );
}

type MoveSession =
  | { kind: 'annotation'; id: string; pointerStart: { x: number; y: number }; initial: Annotation }
  | { kind: 'blur'; id: string; pointerStart: { x: number; y: number }; initial: BlurRegion };

type TextDialogState =
  | null
  | { kind: 'callout'; rect: { x: number; y: number; width: number; height: number } }
  | { kind: 'text'; pos: { x: number; y: number } };

export function StepPreview({ step, onUpdate, activeTool, expandedCanvas, recordingVideoUrl, onStartCaptureSession, captureSessionActive }: StepPreviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showFramePicker, setShowFramePicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step);
  const onUpdateRef = useRef(onUpdate);
  stepRef.current = step;
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    setUploadError(null);
  }, [step.id]);

  const uploadImageBlob = useCallback(
    async (blob: Blob, filename: string): Promise<boolean> => {
      setUploadError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        const file =
          blob instanceof File
            ? blob
            : new File([blob], filename, { type: blob.type || 'image/png' });
        fd.append('file', file);
        const res = await fetch(`/api/guide-steps/${step.id}/screenshot`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Upload failed');
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const url =
          typeof raw.screenshotUrl === 'string'
            ? raw.screenshotUrl
            : typeof raw.screenshot_url === 'string'
              ? raw.screenshot_url
              : null;
        if (url) {
          onUpdate({ screenshotUrl: url, screenshotOriginalUrl: null });
          return true;
        }
        setUploadError('Upload finished but no image URL came back. Check Supabase storage / env keys.');
        return false;
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [step.id, onUpdate]
  );

  const handleScreenshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setUploadError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    await uploadImageBlob(file, file.name);
  };

  const handleRecordingFrameBlob = useCallback(
    async (blob: Blob) => {
      const ok = await uploadImageBlob(blob, 'recording-frame.png');
      if (ok) setShowFramePicker(false);
    },
    [uploadImageBlob]
  );

  const moveSessionRef = useRef<MoveSession | null>(null);
  const [movePointer, setMovePointer] = useState<{ x: number; y: number } | null>(null);

  const tailDragRef = useRef<null | {
    annId: string;
    pointerStart: { x: number; y: number };
    initialOffset: number;
    edge: CalloutTailEdge;
    rectW: number;
    rectH: number;
  }>(null);
  const [tailAdjustLive, setTailAdjustLive] = useState<null | {
    annId: string;
    offset: number;
    edge: CalloutTailEdge;
  }>(null);

  const [drawing, setDrawing] = useState(false);
  /** Mirrors ref so dashed preview re-renders (refs alone don’t trigger paint). */
  const [drawKind, setDrawKind] = useState<'blur' | 'rect' | 'arrow' | 'crop' | null>(null);
  const drawGestureRef = useRef<'blur' | 'rect' | 'arrow' | 'crop' | null>(null);
  const rectAnnTypeRef = useRef<RectAnnTool | null>(null);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState({ x: 0, y: 0 });

  const [textDialog, setTextDialog] = useState<TextDialogState>(null);
  const [textDraft, setTextDraft] = useState('');
  const [cropConfirm, setCropConfirm] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const [restoreOriginalOpen, setRestoreOriginalOpen] = useState(false);
  /** After finishing a callout drag: show this box briefly, then open the text modal. */
  const [pendingCalloutRect, setPendingCalloutRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pendingCalloutFading, setPendingCalloutFading] = useState(false);
  const [circleStrokeHex, setCircleStrokeHex] = useState<string>(CIRCLE_OUTLINE_PRESETS[0].stroke);
  const [boxStrokeHex, setBoxStrokeHex] = useState<string>(CIRCLE_OUTLINE_PRESETS[0].stroke);
  const [highlightStrokeHex, setHighlightStrokeHex] = useState<string>(HIGHLIGHT_COLOR_PRESETS[0].stroke);

  useEffect(() => {
    if (!textDialog) return;
    if (textDialog.kind === 'callout') {
      setTextDraft('Tip: describe what to do here');
    } else {
      setTextDraft('Label');
    }
  }, [textDialog]);

  useEffect(() => {
    if (!cropConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCropConfirm(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cropConfirm]);

  useEffect(() => {
    if (!restoreOriginalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRestoreOriginalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restoreOriginalOpen]);

  /** After defining a callout area: hold, fade frame out, then open the text dialog. */
  useEffect(() => {
    if (!pendingCalloutRect) {
      setPendingCalloutFading(false);
      return;
    }
    setPendingCalloutFading(false);
    const rect = pendingCalloutRect;
    const holdMs = Math.max(400, CALLOUT_TEXT_MODAL_DELAY_MS - CALLOUT_PENDING_FADE_MS);
    const tFade = window.setTimeout(() => setPendingCalloutFading(true), holdMs);
    const tModal = window.setTimeout(() => {
      setTextDialog({ kind: 'callout', rect });
      setPendingCalloutRect(null);
      setPendingCalloutFading(false);
    }, CALLOUT_TEXT_MODAL_DELAY_MS);
    return () => {
      clearTimeout(tFade);
      clearTimeout(tModal);
    };
  }, [pendingCalloutRect]);

  useEffect(() => {
    if (!pendingCalloutRect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPendingCalloutRect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingCalloutRect]);

  useEffect(() => {
    setPendingCalloutRect(null);
  }, [step.id]);

  useEffect(() => {
    if (activeTool !== 'callout') setPendingCalloutRect(null);
  }, [activeTool]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const td = tailDragRef.current;
      if (td) {
        const delta = tailOffsetDeltaFromPointer(
          td.edge,
          td.pointerStart,
          { x: e.clientX, y: e.clientY },
          td.rectW,
          td.rectH
        );
        const nextOff = clampTailOffset(td.initialOffset + delta);
        setTailAdjustLive({ annId: td.annId, offset: nextOff, edge: td.edge });
        return;
      }
      if (!moveSessionRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMovePointer({ x, y });
    };
    const onUp = (e: MouseEvent) => {
      const td = tailDragRef.current;
      if (td) {
        const delta = tailOffsetDeltaFromPointer(
          td.edge,
          td.pointerStart,
          { x: e.clientX, y: e.clientY },
          td.rectW,
          td.rectH
        );
        const nextOff = clampTailOffset(td.initialOffset + delta);
        tailDragRef.current = null;
        setTailAdjustLive(null);
        const s = stepRef.current;
        onUpdateRef.current({
          annotations: s.annotations.map((a) =>
            a.id === td.annId ? { ...a, calloutTailOffset: nextOff } : a
          ),
        });
        return;
      }

      const session = moveSessionRef.current;
      const el = containerRef.current;
      if (!session || !el) {
        moveSessionRef.current = null;
        setMovePointer(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const dx = x - session.pointerStart.x;
      const dy = y - session.pointerStart.y;
      moveSessionRef.current = null;
      setMovePointer(null);
      if (Math.abs(dx) + Math.abs(dy) < 0.12) return;
      const s = stepRef.current;
      if (session.kind === 'blur') {
        const next = blurRegionWithDelta(session.initial as LooseBlurRegion, dx, dy);
        onUpdateRef.current({
          blurRegions: s.blurRegions.map((r) => (r.id === session.id ? { ...r, ...next } : r)),
        });
      } else {
        const next = annotationWithDelta(session.initial as LooseAnnotation, dx, dy);
        onUpdateRef.current({
          annotations: s.annotations.map((a) => (a.id === session.id ? { ...a, ...next } : a)),
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const finalizeRectOrBlur = useCallback(() => {
    const gesture = drawGestureRef.current;
    const annType = rectAnnTypeRef.current;
    drawGestureRef.current = null;
    rectAnnTypeRef.current = null;
    setDrawKind(null);

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    if (width < 0.8 || height < 0.8) return;

    if (gesture === 'blur') {
      const newRegion: BlurRegion = {
        id: `blur-${Date.now()}`,
        x,
        y,
        width,
        height,
        intensity: BLUR_INTENSITY_DEFAULT,
      };
      onUpdate({ blurRegions: [...step.blurRegions, newRegion] });
      return;
    }

    if (gesture === 'rect' && annType) {
      if (annType === 'callout') {
        setPendingCalloutRect({ x, y, width, height });
        return;
      }

      const ann: Annotation = {
        id: `ann-${Date.now()}`,
        type: annType,
        x,
        y,
        width,
        height,
        ...(annType === 'circle' ? { color: circleStrokeHex } : {}),
        ...(annType === 'box' ? { color: boxStrokeHex } : {}),
        ...(annType === 'highlight' ? { color: highlightStrokeHex } : {}),
      };
      onUpdate({ annotations: [...step.annotations, ann] });
    }
  }, [
    drawStart,
    drawCurrent,
    onUpdate,
    step.annotations,
    step.blurRegions,
    circleStrokeHex,
    boxStrokeHex,
    highlightStrokeHex,
  ]);

  const finalizeArrow = useCallback(() => {
    drawGestureRef.current = null;
    setDrawKind(null);
    const x1 = drawStart.x;
    const y1 = drawStart.y;
    const x2 = drawCurrent.x;
    const y2 = drawCurrent.y;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1.2) return;
    const ann: Annotation = {
      id: `ann-${Date.now()}`,
      type: 'arrow',
      x: x1,
      y: y1,
      x2,
      y2,
    };
    onUpdate({ annotations: [...step.annotations, ann] });
  }, [drawStart, drawCurrent, onUpdate, step.annotations]);

  const beginMoveAnnotation = useCallback(
    (e: React.MouseEvent, ann: Annotation) => {
      if (activeTool !== 'move') return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getRelativePosition(e);
      moveSessionRef.current = {
        kind: 'annotation',
        id: ann.id,
        pointerStart: pos,
        initial: { ...ann },
      };
      setMovePointer(pos);
    },
    [activeTool, getRelativePosition]
  );

  const beginMoveBlur = useCallback(
    (e: React.MouseEvent, region: BlurRegion) => {
      if (activeTool !== 'move') return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getRelativePosition(e);
      moveSessionRef.current = {
        kind: 'blur',
        id: region.id,
        pointerStart: pos,
        initial: { ...region },
      };
      setMovePointer(pos);
    },
    [activeTool, getRelativePosition]
  );

  const startTailAdjust = useCallback(
    (e: React.MouseEvent, ann: Annotation) => {
      if (activeTool !== 'callout') return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const { edge, offset } = parseCalloutTail(ann);
      tailDragRef.current = {
        annId: ann.id,
        pointerStart: { x: e.clientX, y: e.clientY },
        initialOffset: offset,
        edge,
        rectW: rect.width,
        rectH: rect.height,
      };
      setTailAdjustLive({ annId: ann.id, offset, edge });
    },
    [activeTool]
  );

  const cycleTailEdgeForAnn = useCallback(
    (ann: Annotation) => {
      if (activeTool !== 'callout') return;
      const { edge } = parseCalloutTail(ann);
      const next = cycleCalloutTailEdge(edge);
      onUpdate({
        annotations: step.annotations.map((a) =>
          a.id === ann.id ? { ...a, calloutTailEdge: next } : a
        ),
      });
    },
    [activeTool, onUpdate, step.annotations]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (activeTool === 'select' || activeTool === 'move') return;

      const pos = getRelativePosition(e);

      if (activeTool === 'blur') {
        drawGestureRef.current = 'blur';
        setDrawKind('blur');
        setDrawStart(pos);
        setDrawCurrent(pos);
        setDrawing(true);
        return;
      }

      if (activeTool === 'arrow') {
        drawGestureRef.current = 'arrow';
        setDrawKind('arrow');
        setDrawStart(pos);
        setDrawCurrent(pos);
        setDrawing(true);
        return;
      }

      if (activeTool === 'crop') {
        if (!step.screenshotUrl) return;
        drawGestureRef.current = 'crop';
        setDrawKind('crop');
        setDrawStart(pos);
        setDrawCurrent(pos);
        setDrawing(true);
        return;
      }

      if (activeTool && isRectAnnotationTool(activeTool)) {
        setPendingCalloutRect(null);
        drawGestureRef.current = 'rect';
        rectAnnTypeRef.current = activeTool;
        setDrawKind('rect');
        setDrawStart(pos);
        setDrawCurrent(pos);
        setDrawing(true);
      }
    },
    [activeTool, getRelativePosition, step.screenshotUrl]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setDrawCurrent(getRelativePosition(e));
    },
    [drawing, getRelativePosition]
  );

  const handleCropApply = useCallback(async () => {
    if (!cropConfirm || !step.screenshotUrl) return;
    setCropBusy(true);
    setUploadError(null);
    try {
      const blob = await cropImageToPngBlob(step.screenshotUrl, cropConfirm);
      if (!blob) {
        setUploadError(
          'Could not crop this image (browser security may block it). Try “Replace screenshot” with a file from your computer, or another browser.'
        );
        return;
      }
      const fd = new FormData();
      fd.append('file', blob, 'cropped.png');
      const res = await fetch(`/api/guide-steps/${step.id}/screenshot`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Upload failed');
      }
      const data = (await res.json()) as { screenshotUrl?: string | null };
      if (data.screenshotUrl) {
        const preserveOriginal =
          !step.screenshotOriginalUrl && Boolean(step.screenshotUrl);
        onUpdate({
          screenshotUrl: data.screenshotUrl,
          annotations: [],
          blurRegions: [],
          ...(preserveOriginal ? { screenshotOriginalUrl: step.screenshotUrl } : {}),
        });
      }
      setCropConfirm(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Crop failed');
    } finally {
      setCropBusy(false);
    }
  }, [cropConfirm, step.id, step.screenshotUrl, step.screenshotOriginalUrl, onUpdate]);

  const handleRestoreOriginalScreenshot = useCallback(() => {
    if (!step.screenshotOriginalUrl) return;
    setRestoreOriginalOpen(true);
  }, [step.screenshotOriginalUrl]);

  const handleConfirmRestoreOriginalScreenshot = useCallback(() => {
    const orig = step.screenshotOriginalUrl;
    if (!orig) return;
    onUpdate({
      screenshotUrl: orig,
      screenshotOriginalUrl: null,
      annotations: [],
      blurRegions: [],
    });
    setRestoreOriginalOpen(false);
  }, [step.screenshotOriginalUrl, onUpdate]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    const g = drawGestureRef.current;
    if (g === 'arrow') {
      finalizeArrow();
      return;
    }
    if (g === 'crop') {
      drawGestureRef.current = null;
      setDrawKind(null);
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);
      if (width >= 1 && height >= 1) {
        setCropConfirm({ x, y, width, height });
      }
      return;
    }
    finalizeRectOrBlur();
  }, [drawing, finalizeArrow, finalizeRectOrBlur, drawStart, drawCurrent]);

  const removeBlurRegion = (regionId: string) => {
    onUpdate({ blurRegions: step.blurRegions.filter((r) => r.id !== regionId) });
  };

  const removeAnnotation = (id: string) => {
    onUpdate({ annotations: step.annotations.filter((a) => a.id !== id) });
  };

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'badge' && activeTool !== 'text') return;
      if (e.button !== 0) return;
      const pos = getRelativePosition(e);
      if (activeTool === 'badge') {
        const ann: Annotation = {
          id: `ann-${Date.now()}`,
          type: 'badge',
          x: pos.x,
          y: pos.y,
          text: '1',
        };
        onUpdate({ annotations: [...step.annotations, ann] });
        return;
      }
      setTextDialog({ kind: 'text', pos: { x: pos.x, y: pos.y } });
    },
    [activeTool, getRelativePosition, onUpdate, step.annotations]
  );

  const handleTextModalConfirm = useCallback(() => {
    if (!textDialog) return;
    const trimmed = textDraft.trim();
    if (textDialog.kind === 'callout') {
      const { rect } = textDialog;
      const ann: Annotation = {
        id: `ann-${Date.now()}`,
        type: 'callout',
        ...rect,
        text: trimmed || 'Callout',
        ...defaultCalloutTail(),
      };
      onUpdate({ annotations: [...step.annotations, ann] });
    } else {
      const ann: Annotation = {
        id: `ann-${Date.now()}`,
        type: 'text',
        x: textDialog.pos.x,
        y: textDialog.pos.y,
        text: trimmed || 'Label',
      };
      onUpdate({ annotations: [...step.annotations, ann] });
    }
    setTextDialog(null);
  }, [textDialog, textDraft, onUpdate, step.annotations]);

  const handleTextModalCancel = useCallback(() => {
    setTextDialog(null);
  }, []);

  const drawRect = drawing
    ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        width: Math.abs(drawCurrent.x - drawStart.x),
        height: Math.abs(drawCurrent.y - drawStart.y),
      }
    : null;

  const arrowPreview =
    drawing && drawKind === 'arrow'
      ? { x1: drawStart.x, y1: drawStart.y, x2: drawCurrent.x, y2: drawCurrent.y }
      : null;

  const arrowPreviewGeom = useMemo(() => {
    if (!arrowPreview) return null;
    const { x1, y1, x2, y2 } = arrowPreview;
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 1.2) return { mode: 'short' as const, x1, y1, x2, y2 };
    return { mode: 'full' as const, ...computeArrowParts(x1, y1, x2, y2), x1, y1 };
  }, [arrowPreview]);

  const displayAnn = (ann: Annotation): Annotation => {
    const session = moveSessionRef.current;
    if (!session || session.kind !== 'annotation' || session.id !== ann.id || movePointer == null) {
      return ann;
    }
    const dx = movePointer.x - session.pointerStart.x;
    const dy = movePointer.y - session.pointerStart.y;
    return { ...ann, ...annotationWithDelta(session.initial as LooseAnnotation, dx, dy) };
  };

  const displayBlur = (r: BlurRegion): BlurRegion => {
    const session = moveSessionRef.current;
    if (!session || session.kind !== 'blur' || session.id !== r.id || movePointer == null) {
      return r;
    }
    const dx = movePointer.x - session.pointerStart.x;
    const dy = movePointer.y - session.pointerStart.y;
    return { ...r, ...blurRegionWithDelta(session.initial as LooseBlurRegion, dx, dy) };
  };

  const overlayInteractive = activeTool === 'select' || activeTool === 'move';
  /** Callouts also need hits for the Pointer tool (tail); other overlays stay inert so they don’t block. */
  const calloutOverlayInteractive =
    activeTool === 'select' || activeTool === 'move' || activeTool === 'callout';

  const cursorClass =
    activeTool === 'move'
      ? movePointer != null
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : activeTool === 'select'
        ? ''
        : crosshairTool(activeTool)
          ? 'cursor-crosshair'
          : '';

  return (
    <div className={expandedCanvas ? 'w-full max-w-none min-w-0' : 'w-full max-w-4xl'}>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
            {step.order}
          </span>
          <h2 className="text-xl font-bold text-gray-100">{step.title}</h2>
        </div>
        <p className="text-gray-400 ml-11">{step.description}</p>
      </div>

      {step.screenshotUrl ? (
        <div className="mb-2 space-y-2">
          <p className="text-xs text-gray-500">
            {activeTool === 'select' && (
              <span>Click an annotation or blur region to remove it.</span>
            )}
            {activeTool === 'move' && (
              <span>Drag any annotation or blur region to reposition it on the screenshot.</span>
            )}
            {activeTool === 'arrow' && <span>Drag to draw an arrow.</span>}
            {(activeTool === 'box' || activeTool === 'circle') && (
              <span>
                Pick an outline colour below, then drag on the image to draw a{' '}
                {activeTool === 'box' ? 'rectangle' : 'ellipse'} (same palette for both tools).
              </span>
            )}
            {activeTool === 'callout' && !pendingCalloutRect && (
              <span>
                Drag on empty image to add a callout (frame appears briefly, then you type). On an{' '}
                <strong className="text-gray-400">existing</strong> callout, drag the <strong className="text-gray-400">text box</strong> to slide the pointer along its side, or <strong className="text-gray-400">double-click</strong> the box to move the pointer to the next side (bottom → right → top → left).
              </span>
            )}
            {activeTool === 'highlight' && (
              <span>
                Pick a bright colour below, then drag on the image to add a translucent highlight.
              </span>
            )}
            {(activeTool === 'badge' || activeTool === 'text') && (
              <span>Click where you want the {activeTool === 'badge' ? 'badge number' : 'text label'}.</span>
            )}
            {activeTool === 'blur' && (
            <span>Drag to add a blur region. Adjust strength per region in the Properties panel (right sidebar).</span>
          )}
            {activeTool === 'crop' && (
              <span>
                Drag to choose the area to keep. Applying crop replaces the screenshot and clears annotations and blur
                regions.
              </span>
            )}
          </p>
          {pendingCalloutRect && (
            <p className="text-xs text-gray-300 border-l-2 border-brand-500/80 pl-3 py-1 leading-relaxed">
              <span className="text-brand-400 font-medium">Callout area set.</span>{' '}
              Text editor opens in a moment (the frame will fade first).
              <span className="text-gray-500"> Esc to cancel.</span>
            </p>
          )}
          {(activeTool === 'circle' || activeTool === 'box') && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-gray-500 shrink-0">Outline:</span>
              {CIRCLE_OUTLINE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  title={p.label}
                  onClick={() => {
                    if (activeTool === 'circle') setCircleStrokeHex(p.stroke);
                    else setBoxStrokeHex(p.stroke);
                  }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-gray-950 ${
                    (activeTool === 'circle' ? circleStrokeHex : boxStrokeHex) === p.stroke
                      ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-gray-950 scale-110'
                      : 'border-gray-700'
                  }`}
                  style={{ backgroundColor: p.stroke }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={`relative bg-gray-900 border border-gray-800 rounded-2xl ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => drawing && handleMouseUp()}
      >
        {step.screenshotUrl ? (
          <>
          {/* Clip only the bitmap; annotations stay overflow-visible so callout tails aren’t cut off */}
          <div className="relative overflow-hidden rounded-2xl select-none">
            <img
              src={step.screenshotUrl}
              alt={step.title}
              className="w-full block pointer-events-none"
              draggable={false}
            />
          </div>
          <div className="absolute inset-0 z-[1] overflow-visible rounded-2xl">
          <div className="relative h-full w-full select-none">

            {/* Hit layer for click tools (above image, below overlays) */}
            {(activeTool === 'badge' || activeTool === 'text') && (
              <button
                type="button"
                aria-label="Place annotation"
                className="absolute inset-0 z-[1] cursor-crosshair bg-transparent"
                onClick={handleImageClick}
              />
            )}

            {step.blurRegions.map((region) => {
              const r = displayBlur(region);
              const strength = clampBlurIntensity(r.intensity);
              const bpx = blurRadiusPx(strength);
              const alpha = blurOverlayAlpha(strength);
              return (
              <div
                key={region.id}
                className={`absolute group z-[2] ${
                  overlayInteractive
                    ? activeTool === 'move'
                      ? 'pointer-events-auto cursor-grab active:cursor-grabbing'
                      : 'pointer-events-auto cursor-pointer'
                    : 'pointer-events-none'
                }`}
                style={{
                  left: `${r.x}%`,
                  top: `${r.y}%`,
                  width: `${r.width}%`,
                  height: `${r.height}%`,
                  backdropFilter: `blur(${bpx}px)`,
                  WebkitBackdropFilter: `blur(${bpx}px)`,
                  backgroundColor: `rgba(15, 23, 42, ${alpha})`,
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'move') beginMoveBlur(e, region);
                }}
                onClick={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    removeBlurRegion(region.id);
                  }
                }}
                title={
                  activeTool === 'select'
                    ? 'Click to remove blur'
                    : activeTool === 'move'
                      ? 'Drag to move blur region'
                      : undefined
                }
              >
                <span
                  className={`absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs items-center justify-center ${
                    activeTool === 'select' ? 'flex' : 'hidden group-hover:flex'
                  }`}
                >
                  ×
                </span>
              </div>
            );
            })}

            {/* Shape annotations (below callouts/text for stacking) */}
            {step.annotations.map((ann) => {
              const d = displayAnn(ann);
              if (ann.type === 'highlight' && d.width != null && d.height != null) {
                const hiStroke = resolveHighlightColor(d.color);
                const hiFill = circleFillRgba(hiStroke, 0.24);
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[3] rounded-md ${
                      overlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab hover:ring-2 hover:ring-brand-500/30'
                          : 'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-red-500/40'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      width: `${d.width}%`,
                      height: `${d.height}%`,
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: hiStroke,
                      backgroundColor: hiFill,
                      boxShadow: `0 0 14px ${hiStroke}66`,
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={activeTool === 'select' ? 'Click to remove' : activeTool === 'move' ? 'Drag to move' : undefined}
                  />
                );
              }
              if (ann.type === 'circle' && d.width != null && d.height != null) {
                const stroke = resolveCircleStroke(d.color);
                const fill = circleFillRgba(stroke, 0.14);
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[3] border-2 rounded-full box-border ${
                      overlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab hover:ring-2 hover:ring-brand-500/30'
                          : 'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-red-500/40'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      width: `${d.width}%`,
                      height: `${d.height}%`,
                      borderColor: stroke,
                      backgroundColor: fill,
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={activeTool === 'select' ? 'Click to remove' : activeTool === 'move' ? 'Drag to move' : undefined}
                  />
                );
              }
              if (ann.type === 'box' && d.width != null && d.height != null) {
                const stroke = resolveCircleStroke(ann.color);
                const fill = circleFillRgba(stroke, 0.12);
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[3] border-2 rounded-md box-border ${
                      overlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab hover:ring-2 hover:ring-brand-500/30'
                          : 'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-red-500/40'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      width: `${d.width}%`,
                      height: `${d.height}%`,
                      borderColor: stroke,
                      backgroundColor: fill,
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={activeTool === 'select' ? 'Click to remove' : activeTool === 'move' ? 'Drag to move' : undefined}
                  />
                );
              }
              return null;
            })}

            {step.annotations.map((ann) => {
              if (ann.type === 'callout') {
                const d = displayAnn(ann);
                const hasBox = d.width != null && d.height != null && d.width > 0 && d.height > 0;
                const maxW = hasBox ? `${Math.min(d.width!, 92)}%` : 'min(280px, 85%)';
                const parsed = parseCalloutTail(d);
                const live =
                  tailAdjustLive?.annId === ann.id
                    ? { edge: tailAdjustLive.edge, offset: tailAdjustLive.offset }
                    : parsed;
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[4] ${
                      calloutOverlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab'
                          : activeTool === 'callout'
                            ? 'pointer-events-auto cursor-crosshair'
                            : 'pointer-events-auto cursor-pointer'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      maxWidth: maxW,
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={
                      activeTool === 'select'
                        ? 'Click to remove'
                        : activeTool === 'move'
                          ? 'Drag to move'
                          : activeTool === 'callout'
                            ? 'Drag text box: slide pointer. Double-click: next side. Drag empty area: new callout.'
                            : undefined
                    }
                  >
                    <div
                      className={`relative inline-block w-full max-w-full rounded-xl border-2 border-brand-400 bg-gray-950 px-3 py-2 text-sm font-medium leading-snug text-gray-50 shadow-xl ring-1 ring-black/50 ${
                        activeTool === 'callout' ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      onMouseDown={(e) => {
                        if (activeTool === 'callout') startTailAdjust(e, ann);
                      }}
                      onDoubleClick={(e) => {
                        if (activeTool === 'callout') {
                          e.preventDefault();
                          e.stopPropagation();
                          cycleTailEdgeForAnn(ann);
                        }
                      }}
                    >
                      <CalloutTailVisual
                        edge={live.edge}
                        offsetPct={live.offset}
                        showAdjustHandle={activeTool === 'callout'}
                      />
                      <span className="relative z-[2]">{ann.text || 'Callout'}</span>
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {step.annotations.map((ann) => {
              if (ann.type === 'badge') {
                const d = displayAnn(ann);
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[5] -translate-x-1/2 -translate-y-1/2 ${
                      overlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab'
                          : 'pointer-events-auto cursor-pointer'
                        : 'pointer-events-none'
                    }`}
                    style={{ left: `${d.x}%`, top: `${d.y}%` }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={activeTool === 'move' ? 'Drag to move' : undefined}
                  >
                    <span className="w-7 h-7 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shadow-lg">
                      {ann.text || '!'}
                    </span>
                  </div>
                );
              }
              if (ann.type === 'text') {
                const d = displayAnn(ann);
                return (
                  <div
                    key={ann.id}
                    className={`absolute z-[5] max-w-[45%] ${
                      overlayInteractive
                        ? activeTool === 'move'
                          ? 'pointer-events-auto cursor-grab'
                          : 'pointer-events-auto cursor-pointer'
                        : 'pointer-events-none'
                    }`}
                    style={{ left: `${d.x}%`, top: `${d.y}%` }}
                    onMouseDown={(e) => {
                      if (activeTool === 'move') beginMoveAnnotation(e, ann);
                    }}
                    onClick={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        removeAnnotation(ann.id);
                      }
                    }}
                    title={activeTool === 'move' ? 'Drag to move' : undefined}
                  >
                    <div className="bg-black/80 text-white text-sm px-2.5 py-1 rounded-md border border-white/20 shadow-md">
                      {ann.text || 'Text'}
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {/* Arrows: shaft + computed triangle head (no SVG markers — consistent, pro look) */}
            <svg
              className={`absolute inset-0 z-[6] w-full h-full ${
                overlayInteractive ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {step.annotations.map((ann) => {
                if (ann.type !== 'arrow' || ann.x2 == null || ann.y2 == null) return null;
                const d = displayAnn(ann);
                if (d.x2 == null || d.y2 == null) return null;
                const g = computeArrowParts(d.x, d.y, d.x2, d.y2);
                const pts = `${g.wing1.x},${g.wing1.y} ${g.tip.x},${g.tip.y} ${g.wing2.x},${g.wing2.y}`;
                return (
                  <g key={ann.id}>
                    {overlayInteractive && (
                      <line
                        x1={d.x}
                        y1={d.y}
                        x2={d.x2}
                        y2={d.y2}
                        stroke="transparent"
                        strokeWidth={activeTool === 'move' ? '10' : '6'}
                        strokeLinecap="round"
                        style={{
                          pointerEvents: 'stroke',
                          cursor: activeTool === 'move' ? 'grab' : 'pointer',
                        }}
                        onMouseDown={(e) => {
                          if (activeTool === 'move') beginMoveAnnotation(e, ann);
                        }}
                        onClick={(e) => {
                          if (activeTool === 'select') {
                            e.stopPropagation();
                            removeAnnotation(ann.id);
                          }
                        }}
                      />
                    )}
                    <line
                      x1={d.x}
                      y1={d.y}
                      x2={g.shaftEnd.x}
                      y2={g.shaftEnd.y}
                      stroke="#fbbf24"
                      strokeWidth="0.85"
                      strokeLinecap="round"
                      style={{ pointerEvents: 'none' }}
                    />
                    <polygon
                      points={pts}
                      fill="#fbbf24"
                      stroke="#b45309"
                      strokeWidth="0.1"
                      strokeLinejoin="round"
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}
              {arrowPreviewGeom?.mode === 'short' && (
                <line
                  x1={arrowPreviewGeom.x1}
                  y1={arrowPreviewGeom.y1}
                  x2={arrowPreviewGeom.x2}
                  y2={arrowPreviewGeom.y2}
                  stroke="#fbbf24"
                  strokeWidth="0.85"
                  strokeOpacity={0.9}
                  strokeLinecap="round"
                  strokeDasharray="2 2"
                />
              )}
              {arrowPreviewGeom?.mode === 'full' && (
                <g opacity={0.92}>
                  <line
                    x1={arrowPreviewGeom.x1}
                    y1={arrowPreviewGeom.y1}
                    x2={arrowPreviewGeom.shaftEnd.x}
                    y2={arrowPreviewGeom.shaftEnd.y}
                    stroke="#fbbf24"
                    strokeWidth="0.85"
                    strokeLinecap="round"
                    strokeDasharray="2.2 2.2"
                  />
                  <polygon
                    points={`${arrowPreviewGeom.wing1.x},${arrowPreviewGeom.wing1.y} ${arrowPreviewGeom.tip.x},${arrowPreviewGeom.tip.y} ${arrowPreviewGeom.wing2.x},${arrowPreviewGeom.wing2.y}`}
                    fill="#fbbf24"
                    fillOpacity={0.75}
                    stroke="#b45309"
                    strokeWidth="0.1"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </svg>

            {drawRect && drawKind !== 'arrow' && (
              <div
                className={`absolute z-[7] pointer-events-none ${
                  drawKind === 'blur'
                    ? 'rounded-md border-2 border-dashed border-red-400 bg-red-400/10'
                    : drawKind === 'crop'
                      ? 'rounded-md border-2 border-dashed border-emerald-400 bg-emerald-400/15'
                        : activeTool === 'callout' && drawKind === 'rect'
                        ? 'rounded-md border-2 border-dashed border-gray-200/55 bg-gray-950/30'
                        : activeTool === 'highlight' && drawKind === 'rect'
                          ? 'rounded-md border-2 border-dashed'
                          : activeTool === 'circle' && drawKind === 'rect'
                          ? 'rounded-full border-2 border-dashed'
                          : activeTool === 'box' && drawKind === 'rect'
                            ? 'rounded-md border-2 border-dashed'
                            : 'rounded-md border-2 border-dashed border-brand-400 bg-brand-400/10'
                }`}
                style={{
                  left: `${drawRect.x}%`,
                  top: `${drawRect.y}%`,
                  width: `${drawRect.width}%`,
                  height: `${drawRect.height}%`,
                  ...(activeTool === 'circle' && drawKind === 'rect'
                    ? {
                        borderColor: circleStrokeHex,
                        backgroundColor: circleFillRgba(circleStrokeHex, 0.12),
                      }
                    : {}),
                  ...(activeTool === 'box' && drawKind === 'rect'
                    ? {
                        borderColor: boxStrokeHex,
                        backgroundColor: circleFillRgba(boxStrokeHex, 0.12),
                      }
                    : {}),
                  ...(activeTool === 'highlight' && drawKind === 'rect'
                    ? {
                        borderColor: highlightStrokeHex,
                        backgroundColor: circleFillRgba(highlightStrokeHex, 0.22),
                        boxShadow: `0 0 14px ${highlightStrokeHex}77`,
                      }
                    : {}),
                }}
              />
            )}

            {pendingCalloutRect && (
              <div
                className={`si-callout-pending-frame absolute z-[8] pointer-events-none rounded-md border-2 border-dashed border-gray-300/65 bg-gray-950/40 transition-opacity ease-in-out ${
                  pendingCalloutFading ? 'opacity-0' : ''
                }`}
                style={{
                  left: `${pendingCalloutRect.x}%`,
                  top: `${pendingCalloutRect.y}%`,
                  width: `${pendingCalloutRect.width}%`,
                  height: `${pendingCalloutRect.height}%`,
                  transitionDuration: `${CALLOUT_PENDING_FADE_MS}ms`,
                }}
                aria-hidden
              />
            )}
          </div>
          </div>
          </>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center text-gray-600 p-8 sm:p-12 gap-4">
            <IconTile icon={ImageUp} size="xl" variant="muted" />
            <p className="text-lg font-medium text-gray-300">No screenshot</p>
            <p className="text-sm mt-1 text-center max-w-md text-gray-500">
              Upload a file, or use <strong className="text-gray-400">Take screenshot</strong> to share another browser
              tab, window, or screen. A capture bar appears at the bottom — switch to the shared app, navigate to what
              you want, come back here, and click <strong className="text-gray-400">Capture</strong>. Each capture saves
              to this step and creates the next one automatically.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleScreenshotFile}
            />
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 w-full max-w-lg">
              <button
                type="button"
                disabled={uploading || captureSessionActive}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium"
              >
                {uploading ? 'Uploading…' : 'Upload screenshot'}
              </button>
              <button
                type="button"
                disabled={uploading || captureSessionActive}
                onClick={() => onStartCaptureSession?.()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-800/80 text-gray-200 hover:bg-gray-800 hover:border-gray-500 disabled:opacity-50 text-sm font-medium"
              >
                <Camera className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                Take screenshot
              </button>
              {recordingVideoUrl ? (
                <button
                  type="button"
                  disabled={uploading || captureSessionActive}
                  onClick={() => setShowFramePicker(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-600 bg-gray-800/80 text-gray-200 hover:bg-gray-800 hover:border-gray-500 disabled:opacity-50 text-sm font-medium"
                >
                  <Film className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                  Grab from recording
                </button>
              ) : null}
            </div>
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
            disabled={uploading || captureSessionActive}
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-brand-400 hover:text-brand-300 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Replace screenshot'}
          </button>
          <button
            type="button"
            disabled={uploading || captureSessionActive}
            onClick={() => onStartCaptureSession?.()}
            className="text-sm text-gray-400 hover:text-brand-300 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            New screenshot
          </button>
          {recordingVideoUrl ? (
            <button
              type="button"
              disabled={uploading || captureSessionActive}
              onClick={() => setShowFramePicker(true)}
              className="text-sm text-gray-400 hover:text-brand-300 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
              Grab from recording
            </button>
          ) : null}
          {step.screenshotOriginalUrl ? (
            <button
              type="button"
              disabled={uploading}
              onClick={handleRestoreOriginalScreenshot}
              className="text-sm text-amber-400/90 hover:text-amber-300 disabled:opacity-50"
            >
              Restore original screenshot
            </button>
          ) : null}
          {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
        </div>
      ) : null}

      {(step.blurRegions.length > 0 || step.annotations.length > 0) && (
        <p className="text-xs text-gray-500 mt-2">
          {step.annotations.length} annotation(s), {step.blurRegions.length} blur region(s).
          {activeTool === 'select' ? ' Select tool: click one to delete.' : ''}
        </p>
      )}

      {showFramePicker && recordingVideoUrl ? (
        <RecordingFramePickerModal
          videoUrl={recordingVideoUrl}
          uploading={uploading}
          onCancel={() => !uploading && setShowFramePicker(false)}
          onCaptured={(blob) => void handleRecordingFrameBlob(blob)}
        />
      ) : null}

      <TextAnnotationModal
        open={textDialog !== null}
        title={textDialog?.kind === 'callout' ? 'Callout text' : 'Label text'}
        description={
          textDialog?.kind === 'callout'
            ? 'This text appears in the callout on your guide and in HTML export.'
            : 'Short label shown on the screenshot.'
        }
        placeholder={textDialog?.kind === 'callout' ? 'Tip: describe what to do here' : 'Label'}
        value={textDraft}
        onChange={setTextDraft}
        onConfirm={handleTextModalConfirm}
        onCancel={handleTextModalCancel}
        confirmLabel={textDialog?.kind === 'callout' ? 'Add callout' : 'Add label'}
        multiline={textDialog?.kind === 'callout'}
      />

      {restoreOriginalOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-original-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-md"
            aria-label="Dismiss"
            onClick={() => setRestoreOriginalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-gray-700/90 bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-amber-500/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-800 px-6 py-4">
              <h2 id="restore-original-modal-title" className="text-lg font-semibold text-gray-100">
                Restore original screenshot?
              </h2>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                This brings back the full image from before cropping. Annotations and blur on this step will be removed
                because they were drawn on the cropped image.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreOriginalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreOriginalScreenshot}
                className="px-4 py-2 rounded-lg text-sm bg-amber-600 hover:bg-amber-500 text-white"
              >
                Restore full image
              </button>
            </div>
          </div>
        </div>
      )}

      {cropConfirm && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-md"
            aria-label="Dismiss"
            onClick={() => !cropBusy && setCropConfirm(null)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-gray-700/90 bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-800 px-6 py-4">
              <h2 id="crop-modal-title" className="text-lg font-semibold text-gray-100">
                Apply crop?
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                The selected region becomes the new screenshot. All annotations and blur regions on this step will be
                removed because they no longer line up with the image. You can restore the uncropped image later with
                “Restore original screenshot” below the canvas.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={cropBusy}
                onClick={() => setCropConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cropBusy}
                onClick={() => void handleCropApply()}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {cropBusy ? 'Applying…' : 'Apply crop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
