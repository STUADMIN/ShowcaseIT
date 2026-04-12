'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CircleAlert, ClipboardList, MonitorPlay, Pencil } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LiquidGlassMain } from '@/components/ui/liquid-glass-main';
import { StepPanel } from './step-panel';
import { StepPreview } from './step-preview';
import { EditorToolbar, type Tool } from './editor-toolbar';
import { CaptureSessionModal } from './capture-session-bar';
import { PublishModal } from './publish-modal';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth/auth-context';
import { FRAME_EXTRACTION_ERROR_HINT, isFrameExtractionPlaceholder } from '@/lib/frame-extraction-placeholder';

interface GuideStep {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string;
  /** URL before last crop; used to restore full screenshot in the editor. */
  screenshotOriginalUrl?: string | null;
  annotations: Annotation[];
  blurRegions: BlurRegion[];
  /** When false, omitted from HTML export (editor still shows the step). */
  includeInExport: boolean;
}

interface Annotation {
  id: string;
  type: 'arrow' | 'callout' | 'badge' | 'text' | 'highlight' | 'circle' | 'box';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  calloutTailEdge?: 'bottom' | 'top' | 'left' | 'right';
  calloutTailOffset?: number;
}

interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
}

interface GuideProjectSummary {
  id: string;
  name: string;
  workspaceId: string;
  brandKitId: string | null;
  brandKit?: { id: string; name: string } | null;
}

interface GuideData {
  id: string;
  title: string;
  description: string | null;
  style: string;
  steps: GuideStep[];
  projectId: string;
  brandKitId: string | null;
  noBranding?: boolean;
  project?: GuideProjectSummary | null;
  brandKit?: { id: string; name: string } | null;
  recording?: { id: string; videoUrl: string | null } | null;
}

interface WorkspaceProjectRow {
  id: string;
  name: string;
  brandKitId: string | null;
  brandKit?: { id: string; name: string } | null;
}

export function GuideEditor({ guideId }: { guideId: string }) {
  const { user } = useAuth();
  const { data: guide, loading, refetch } = useApi<GuideData>({ url: `/api/guides/${guideId}` });
  const guideWorkspaceId = guide?.project?.workspaceId;
  const projectsUrl = guideWorkspaceId
    ? `/api/projects?workspaceId=${encodeURIComponent(guideWorkspaceId)}`
    : '';
  const brandKitsUrl = guideWorkspaceId
    ? `/api/brand-kits?workspaceId=${encodeURIComponent(guideWorkspaceId)}`
    : '';
  const { data: workspaceProjects } = useApi<WorkspaceProjectRow[]>({ url: projectsUrl });
  const { data: workspaceBrandKits } = useApi<{ id: string; name: string }[]>({ url: brandKitsUrl });
  const [assignBusy, setAssignBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [guideName, setGuideName] = useState('');
  const [guideDesc, setGuideDesc] = useState('');
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [focusMode, setFocusMode] = useState(false);
  const editorShellRef = useRef<HTMLDivElement>(null);
  /** Last title successfully saved to the API (avoids losing edits on blur/tab close). */
  const savedTitleRef = useRef('');
  const savedDescRef = useRef('');

  /* ── Capture session (persistent screen-share → multi-step capture) ── */
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [captureUploading, setCaptureUploading] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const captureStreamRef = useRef<MediaStream | null>(null);

  const startCaptureSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
      } as Parameters<MediaDevices['getDisplayMedia']>[0]);

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        captureStreamRef.current = null;
        setCaptureStream(null);
      });

      captureStreamRef.current = stream;
      setCaptureStream(stream);
      setCapturedCount(0);

      window.setTimeout(() => {
        try { window.focus(); } catch { /* ignore */ }
      }, 100);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
        console.error('[CaptureSession] getDisplayMedia failed:', err);
      }
    }
  }, []);

  const endCaptureSession = useCallback(() => {
    const stream = captureStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
    }
    captureStreamRef.current = null;
    setCaptureStream(null);
    setCapturedCount(0);
  }, []);
  const editorBootGuideId = useRef<string | null>(null);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = editorShellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* user gesture / unsupported */
    }
  }, []);

  useEffect(() => {
    if (!guide) return;
    if (editorBootGuideId.current !== guide.id) {
      editorBootGuideId.current = guide.id;
      setGuideName(guide.title);
      savedTitleRef.current = guide.title;
      setGuideDesc(guide.description ?? '');
      savedDescRef.current = guide.description ?? '';
    }
    const mapped = guide.steps.map((s: any) => ({
      ...s,
      screenshotUrl: s.screenshotUrl || '',
      screenshotOriginalUrl: s.screenshotOriginalUrl ?? null,
      annotations: Array.isArray(s.annotations) ? s.annotations : [],
      blurRegions: Array.isArray(s.blurRegions) ? s.blurRegions : [],
      includeInExport: s.includeInExport !== false,
    }));
    setSteps(mapped);
    setSelectedStepId((cur) => (mapped.length > 0 && !cur ? mapped[0].id : cur));
  }, [guide]);

  const router = useRouter();
  const selectedStep = steps.find((s) => s.id === selectedStepId);
  const hasRealContent = steps.some((s) => s.screenshotUrl);
  const selectedStepIndex = Math.max(0, steps.findIndex((s) => s.id === selectedStepId));

  const flushTitleToServer = useCallback(async () => {
    const t = guideName.trim() || 'Untitled Guide';
    if (t === savedTitleRef.current) return;
    try {
      await apiPatch(`/api/guides/${guideId}`, { title: t });
      savedTitleRef.current = t;
    } catch {
      /* keep dirty so user can retry */
    }
  }, [guideId, guideName]);

  const flushDescToServer = useCallback(async () => {
    const d = guideDesc.trim();
    if (d === savedDescRef.current) return;
    try {
      await apiPatch(`/api/guides/${guideId}`, { description: d || null });
      savedDescRef.current = d;
    } catch {
      /* keep dirty so user can retry */
    }
  }, [guideId, guideDesc]);

  /** Debounced persist while typing the guide title */
  useEffect(() => {
    if (!guideId || !guide) return;
    const next = guideName.trim() || 'Untitled Guide';
    if (next === savedTitleRef.current) return;
    const id = window.setTimeout(() => {
      void flushTitleToServer();
    }, 900);
    return () => window.clearTimeout(id);
  }, [guide, guideName, guideId, flushTitleToServer]);

  /** Debounced persist while typing the guide description */
  useEffect(() => {
    if (!guideId || !guide) return;
    if (guideDesc.trim() === savedDescRef.current) return;
    const id = window.setTimeout(() => {
      void flushDescToServer();
    }, 900);
    return () => window.clearTimeout(id);
  }, [guide, guideDesc, guideId, flushDescToServer]);

  /** Flush when leaving the tab or closing the page */
  useEffect(() => {
    if (!guide) return;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        void flushTitleToServer();
        void flushDescToServer();
      }
    };
    const onPageHide = () => {
      void flushTitleToServer();
      void flushDescToServer();
    };
    const onBeforeUnload = () => {
      void flushTitleToServer();
      void flushDescToServer();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [guide, flushTitleToServer, flushDescToServer]);

  const autoStepTitle = /^step\s+\d+$/i;

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const prevById = new Map(steps.map((s) => [s.id, s]));
    const updated = [...steps];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    const reordered = updated.map((s, i) => ({ ...s, order: i + 1 }));
    const finalSteps = reordered.map((s) =>
      autoStepTitle.test(s.title.trim()) ? { ...s, title: `Step ${s.order}` } : s
    );
    setSteps(finalSteps);
    fetch(`/api/guides/${guideId}/steps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: finalSteps.map((s) => ({ id: s.id, order: s.order })) }),
    }).catch(() => {});
    finalSteps.forEach((s) => {
      const was = prevById.get(s.id);
      if (was && was.title !== s.title) {
        apiPatch(`/api/guide-steps/${s.id}`, { title: s.title }).catch(() => {});
      }
    });
  };

  const handleStepUpdate = (stepId: string, updates: Partial<GuideStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
    apiPatch(`/api/guide-steps/${stepId}`, updates).catch(() => {});
  };

  const handleAddStep = async () => {
    try {
      const step = await apiPost<GuideStep>(`/api/guides/${guideId}/steps`, {
        title: `Step ${steps.length + 1}`,
        description: 'Describe this step...',
      });
      const newStep = step as GuideStep & { includeInExport?: boolean };
      setSteps((prev) => [
        ...prev,
        {
          ...newStep,
          screenshotUrl: newStep.screenshotUrl || '',
          screenshotOriginalUrl: (newStep as GuideStep).screenshotOriginalUrl ?? null,
          annotations: [],
          blurRegions: [],
          includeInExport: newStep.includeInExport !== false,
        },
      ]);
      setSelectedStepId(step.id);
    } catch {}
  };

  /** Refs so the capture callback always sees current values (avoids stale closures). */
  const selectedStepIdRef = useRef(selectedStepId);
  const stepsRef = useRef(steps);
  selectedStepIdRef.current = selectedStepId;
  stepsRef.current = steps;

  /** Capture session: grab frame → upload to current step → create next empty step → select it. */
  const handleSessionCapture = useCallback(
    async (blob: Blob) => {
      const stepId = selectedStepIdRef.current;
      console.log('[CaptureSession] handleSessionCapture called, stepId:', stepId, 'blob size:', blob.size);
      if (!stepId) {
        console.error('[CaptureSession] no selectedStepId');
        return;
      }
      setCaptureUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', new File([blob], 'capture.png', { type: 'image/png' }));
        console.log('[CaptureSession] uploading to /api/guide-steps/' + stepId + '/screenshot');
        const res = await fetch(`/api/guide-steps/${stepId}/screenshot`, { method: 'POST', body: fd });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.error('[CaptureSession] upload failed:', res.status, errBody);
          throw new Error('Upload failed: ' + res.status);
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const url =
          typeof raw.screenshotUrl === 'string'
            ? raw.screenshotUrl
            : typeof raw.screenshot_url === 'string'
              ? raw.screenshot_url
              : null;
        console.log('[CaptureSession] upload response url:', url);

        if (url) {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === stepId ? { ...s, screenshotUrl: url, screenshotOriginalUrl: null } : s
            )
          );
          setCapturedCount((c) => c + 1);

          const nextOrder = stepsRef.current.length + 1;
          const newRes = await apiPost<GuideStep>(`/api/guides/${guideId}/steps`, {
            title: `Step ${nextOrder}`,
            description: 'Describe this step...',
          });
          const newStep = newRes as GuideStep & { includeInExport?: boolean };
          console.log('[CaptureSession] new step created:', newStep.id);
          setSteps((prev) => [
            ...prev,
            {
              ...newStep,
              screenshotUrl: newStep.screenshotUrl || '',
              screenshotOriginalUrl: newStep.screenshotOriginalUrl ?? null,
              annotations: [],
              blurRegions: [],
              includeInExport: newStep.includeInExport !== false,
            },
          ]);
          setSelectedStepId(newStep.id);
        }
      } catch (err) {
        console.error('[CaptureSession] upload/step-create failed:', err);
      } finally {
        setCaptureUploading(false);
      }
    },
    [guideId]
  );

  const handleDeleteStep = async (stepId: string) => {
    try {
      const prevById = new Map(steps.map((s) => [s.id, s]));
      await apiDelete(`/api/guide-steps/${stepId}`);
      const filtered = steps.filter((s) => s.id !== stepId);
      const renumbered = filtered.map((s, i) => {
        const order = i + 1;
        const title = autoStepTitle.test(s.title.trim()) ? `Step ${order}` : s.title;
        return { ...s, order, title };
      });
      setSteps(renumbered);
      if (selectedStepId === stepId) setSelectedStepId(renumbered[0]?.id ?? '');
      fetch(`/api/guides/${guideId}/steps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: renumbered.map((s) => ({ id: s.id, order: s.order })) }),
      }).catch(() => {});
      renumbered.forEach((s) => {
        const was = prevById.get(s.id);
        if (was && was.title !== s.title) {
          apiPatch(`/api/guide-steps/${s.id}`, { title: s.title }).catch(() => {});
        }
      });
    } catch {}
  };

  if (loading) {
    return <div className="flex h-screen bg-gray-950 items-center justify-center"><p className="text-gray-500">Loading guide...</p></div>;
  }

  return (
    <div
      className={`flex flex-col h-screen bg-gray-950 ${focusMode ? 'fixed inset-0 z-[300]' : ''}`}
    >
      <header
        className={`shrink-0 h-12 border-b border-gray-800 flex items-center justify-between px-4 gap-4 bg-gray-950 z-10 ${
          focusMode ? 'hidden' : ''
        }`}
      >
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <Link
            href="/"
            className="text-sm font-semibold text-brand-400 hover:text-brand-300 shrink-0"
          >
            ShowcaseIt
          </Link>
          <span className="text-gray-700 hidden sm:inline">|</span>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm text-gray-400 min-w-0 overflow-x-auto">
            <Link href="/" className="hover:text-white whitespace-nowrap">Dashboard</Link>
            <Link href="/guides" className="hover:text-white whitespace-nowrap">Guides</Link>
            <Link href="/recordings" className="hover:text-white whitespace-nowrap">Recordings</Link>
            <Link href="/recordings/new" className="hover:text-white whitespace-nowrap hidden sm:inline">New recording</Link>
            <Link href="/export" className="hover:text-white whitespace-nowrap hidden md:inline">Export</Link>
          </nav>
        </div>
        <Link
          href="/guides"
          className="text-sm text-gray-500 hover:text-gray-200 shrink-0"
        >
          ← Back to all guides
        </Link>
      </header>

      <LiquidGlassMain
        as="div"
        className="flex flex-1 min-h-0 overflow-hidden bg-gray-950"
        contentClassName="relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-row"
      >
      <div
        className={`flex h-full min-h-0 w-80 min-w-0 flex-col border-r border-gray-800 bg-gray-950/80 backdrop-blur-sm ${
          focusMode ? 'hidden' : ''
        }`}
      >
        <div className="p-4 border-b border-gray-800">
          <input
            type="text"
            value={guideName}
            onChange={(e) => setGuideName(e.target.value)}
            onBlur={() => void flushTitleToServer()}
            className="w-full bg-transparent text-lg font-bold text-gray-100 outline-none placeholder:text-gray-600"
            placeholder="Guide title..."
          />
          <input
            type="text"
            value={guideDesc}
            onChange={(e) => setGuideDesc(e.target.value)}
            onBlur={() => void flushDescToServer()}
            className="w-full mt-1.5 bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-700"
            placeholder="Guide description (shown in exports)..."
          />
          <p className="text-xs text-gray-600 mt-1">ID: {guideId}</p>
          {guide?.project && user?.id && workspaceProjects && workspaceProjects.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-gray-800 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600">Brand &amp; project</p>
              <p className="text-[10px] text-gray-600 leading-snug">
                Guides follow the <strong className="text-gray-500">project&apos;s</strong> brand unless you set an
                override below.
              </p>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5" htmlFor="si-guide-project">
                  Project
                </label>
                <select
                  id="si-guide-project"
                  value={guide.projectId}
                  disabled={assignBusy}
                  onChange={async (e) => {
                    const pid = e.target.value;
                    if (!pid || pid === guide.projectId || !user.id) return;
                    setAssignBusy(true);
                    try {
                      await apiPatch(`/api/guides/${guideId}`, { userId: user.id, projectId: pid });
                      await refetch();
                    } catch {
                      /* keep UI; user can retry */
                    } finally {
                      setAssignBusy(false);
                    }
                  }}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-brand-600 disabled:opacity-50"
                >
                  {workspaceProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brandKit?.name ? `${p.brandKit.name} — ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>
              {workspaceBrandKits && workspaceBrandKits.length > 0 ? (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5" htmlFor="si-guide-brand-override">
                    Brand override
                  </label>
                  <select
                    id="si-guide-brand-override"
                    value={guide.noBranding ? '__none__' : (guide.brandKitId ?? '')}
                    disabled={assignBusy}
                    onChange={async (e) => {
                      const v = e.target.value;
                      if (!user.id) return;
                      setAssignBusy(true);
                      try {
                        if (v === '__none__') {
                          await apiPatch(`/api/guides/${guideId}`, { userId: user.id, brandKitId: null, noBranding: true });
                        } else {
                          const next = v === '' ? null : v;
                          await apiPatch(`/api/guides/${guideId}`, { userId: user.id, brandKitId: next, noBranding: false });
                        }
                        await refetch();
                      } catch {
                        /* ignore */
                      } finally {
                        setAssignBusy(false);
                      }
                    }}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-brand-600 disabled:opacity-50"
                  >
                    <option value="">Use project brand</option>
                    <option value="__none__">No branding</option>
                    {workspaceBrandKits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                onClick={() => setPublishOpen(true)}
                className="w-full mt-2 py-1.5 rounded-lg border border-blue-600/40 bg-blue-600/10 text-blue-400 text-xs font-medium hover:bg-blue-600/20 transition-colors"
              >
                Publish to...
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex-1 overflow-auto">
          <StepPanel steps={steps} selectedStepId={selectedStepId} onSelect={setSelectedStepId} onReorder={handleReorder} onDelete={handleDeleteStep} />
        </div>
        <div className="p-3 border-t border-gray-800">
          <button onClick={handleAddStep} className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">+ Add Step</button>
        </div>
      </div>
      <div
        ref={editorShellRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-950/80 backdrop-blur-sm min-h-0"
      >
        <EditorToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          guideId={guideId}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((v) => !v)}
          stepIndex={selectedStepIndex}
          stepCount={steps.length}
          onStepPrev={() => {
            if (selectedStepIndex > 0) setSelectedStepId(steps[selectedStepIndex - 1].id);
          }}
          onStepNext={() => {
            if (selectedStepIndex < steps.length - 1) setSelectedStepId(steps[selectedStepIndex + 1].id);
          }}
          onToggleBrowserFullscreen={toggleBrowserFullscreen}
        />
        <div
          className={`flex-1 overflow-auto min-h-0 flex items-start justify-center ${
            focusMode ? 'p-4 items-stretch' : 'p-8'
          }`}
        >
          {!hasRealContent && !selectedStep?.screenshotUrl ? (
            <div className="text-center mt-16 max-w-lg">
              <div className="flex justify-center mb-6">
                <IconTile icon={ClipboardList} size="xl" variant="brand" />
              </div>
              <h3 className="text-2xl font-bold text-gray-100 mb-3">Your guide is empty</h3>
              <p className="text-gray-400 mb-4">
                Record your screen to auto-generate steps with screenshots, or add steps manually below.
              </p>
              <p className="text-gray-500 text-sm mb-8">
                Already have a recording? Go to{' '}
                <Link href="/recordings" className="text-blue-400 hover:underline">Recordings</Link>
                , find it with status <strong className="text-gray-400">ready</strong>, and click{' '}
                <strong className="text-gray-400">Generate Guide</strong> again — or delete this guide and start over.
              </p>

              <div className="grid grid-cols-1 gap-4 mb-8">
                <Link
                  href="/recordings/new"
                  className="flex items-center gap-4 p-5 rounded-xl bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 hover:border-blue-500/50 transition-all text-left group"
                >
                  <IconTile icon={MonitorPlay} size="lg" variant="brandInteractive" />
                  <div>
                    <p className="font-semibold text-blue-400">Record Screen</p>
                    <p className="text-sm text-gray-400">Capture a walkthrough and auto-generate steps with screenshots</p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={handleAddStep}
                  className="flex items-center gap-4 p-5 rounded-xl bg-gray-800/50 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-all text-left group"
                >
                  <IconTile icon={Pencil} size="lg" variant="muted" className="group-hover:ring-brand-500/20 group-hover:bg-brand-500/10 group-hover:text-brand-400/90" />
                  <div>
                    <p className="font-semibold text-gray-200">Add Steps Manually</p>
                    <p className="text-sm text-gray-400">Create steps one by one and upload your own screenshots</p>
                  </div>
                </button>
              </div>

              <div className="p-4 rounded-lg bg-gray-900/50 text-sm text-gray-500">
                <p className="font-medium text-gray-400 mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-left">
                  <li>Record your screen; use Mark step (browser) or real clicks (desktop) for each key moment</li>
                  <li>ShowcaseIt grabs one screenshot per marker/click—not every frame</li>
                  <li>Edit titles, descriptions, and annotations</li>
                  <li>Export as HTML, PDF, or publish to Confluence</li>
                </ol>
              </div>
            </div>
          ) : selectedStep ? (
            <StepPreview
              step={selectedStep}
              onUpdate={(updates) => handleStepUpdate(selectedStep.id, updates as Partial<GuideStep>)}
              activeTool={activeTool}
              expandedCanvas={focusMode}
              recordingVideoUrl={guide?.recording?.videoUrl ?? null}
              onStartCaptureSession={() => void startCaptureSession()}
              captureSessionActive={!!captureStream}
            />
          ) : (
            <div className="text-gray-500 text-center mt-32"><p className="text-lg">Select a step to preview</p></div>
          )}
        </div>
      </div>
      <div
        className={`flex h-full min-h-0 w-80 lg:w-96 shrink-0 flex-col overflow-hidden border-l border-gray-800 bg-gray-950/80 backdrop-blur-sm ${
          focusMode ? 'hidden' : ''
        }`}
      >
        <div className="shrink-0 border-b border-gray-800/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Properties</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {selectedStep ? (
          <div className="space-y-4">
            {selectedStep.description.includes(FRAME_EXTRACTION_ERROR_HINT) ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/45 p-3 space-y-2">
                <div className="flex gap-2.5">
                  <CircleAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-amber-100">No screenshots from recording</p>
                    <p className="text-xs text-amber-100/85 leading-relaxed">
                      This text was added automatically because the server couldn&apos;t pull frames from the video. It
                      isn&apos;t a mistake in the sidebar — try{' '}
                      <Link href="/recordings" className="text-brand-400 hover:underline">
                        Recordings
                      </Link>{' '}
                      → Generate guide again, or check{' '}
                      <code className="text-amber-200/90 bg-black/25 px-1 rounded">/api/health/ffmpeg</code>.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStepUpdate(selectedStep.id, { description: '' })}
                      className="text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      Clear message
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Step Title</label>
              <input type="text" value={selectedStep.title} onChange={(e) => handleStepUpdate(selectedStep.id, { title: e.target.value })} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-brand-600" />
            </div>
            <div className="flex flex-col gap-1 min-h-0">
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <textarea
                value={
                  isFrameExtractionPlaceholder(selectedStep.description)
                    ? ''
                    : selectedStep.description
                }
                placeholder={
                  isFrameExtractionPlaceholder(selectedStep.description)
                    ? 'Describe this step after you fix the recording — details are in the notice above.'
                    : undefined
                }
                onChange={(e) => handleStepUpdate(selectedStep.id, { description: e.target.value })}
                rows={10}
                spellCheck
                className="w-full min-h-[11rem] max-h-[min(55vh,28rem)] resize-y bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600 leading-relaxed break-words placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Annotations</label>
              <p className="text-xs text-gray-600">{selectedStep.annotations.length} annotation(s)</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Blur regions</label>
              {selectedStep.blurRegions.length === 0 ? (
                <p className="text-xs text-gray-600">None — use the Blur tool on the preview to add one.</p>
              ) : (
                <ul className="space-y-3 mt-2">
                  {selectedStep.blurRegions.map((br, i) => (
                    <li
                      key={br.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-400">Region {i + 1}</span>
                        <span className="text-xs tabular-nums text-brand-400">{Math.round(br.intensity ?? 50)}%</span>
                      </div>
                      <label className="sr-only" htmlFor={`blur-${br.id}`}>
                        Blur strength for region {i + 1}
                      </label>
                      <input
                        id={`blur-${br.id}`}
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.min(100, Math.max(0, br.intensity ?? 50))}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          handleStepUpdate(selectedStep.id, {
                            blurRegions: selectedStep.blurRegions.map((r) =>
                              r.id === br.id ? { ...r, intensity: v } : r
                            ),
                          });
                        }}
                        className="w-full h-2 accent-brand-500 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-600 leading-snug">
                        Lower = lighter frost; higher = stronger privacy blur. Adjust each region separately.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-600"
                checked={selectedStep.includeInExport}
                onChange={(e) => handleStepUpdate(selectedStep.id, { includeInExport: e.target.checked })}
              />
              <span>
                <span className="text-sm text-gray-200 block">Include in HTML export</span>
                <span className="text-xs text-gray-600">
                  Main <strong className="text-gray-500">Preview</strong> / <strong className="text-gray-500">Export</strong>{' '}
                  include <strong className="text-gray-500">all</strong> steps. Uncheck to exclude this step only when you
                  use <strong className="text-gray-500">Export (filtered)</strong> in the toolbar. The center canvas always
                  shows every step while you edit.
                </span>
              </span>
            </label>
          </div>
        ) : !hasRealContent ? (
          <div className="text-sm text-gray-500">
            <p>Record your screen or add steps to get started.</p>
          </div>
        ) : null}
        </div>
      </div>
      </LiquidGlassMain>

      {captureStream && (
        <CaptureSessionModal
          stream={captureStream}
          stepNumber={selectedStep?.order ?? steps.length}
          capturedCount={capturedCount}
          uploading={captureUploading}
          onCapture={(blob) => void handleSessionCapture(blob)}
          onDone={endCaptureSession}
        />
      )}

      {guide && (
        <PublishModal
          open={publishOpen}
          guideId={guideId}
          currentProjectId={guide.projectId}
          onClose={() => setPublishOpen(false)}
          projects={workspaceProjects ?? []}
          brandKits={workspaceBrandKits ?? []}
        />
      )}
    </div>
  );
}
