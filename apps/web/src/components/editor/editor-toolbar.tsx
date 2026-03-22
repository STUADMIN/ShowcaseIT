'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  Crop,
  Hash,
  Highlighter,
  MessageSquare,
  MousePointer2,
  Move,
  ScanLine,
  Square,
  Type,
} from 'lucide-react';

export type Tool =
  | 'select'
  | 'move'
  | 'arrow'
  | 'callout'
  | 'box'
  | 'circle'
  | 'badge'
  | 'highlight'
  | 'blur'
  | 'text'
  | 'crop';

const tools: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'move', label: 'Move', icon: Move },
  { id: 'arrow', label: 'Arrow', icon: ArrowRight },
  { id: 'callout', label: 'Callout', icon: MessageSquare },
  { id: 'box', label: 'Box', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'badge', label: 'Badge', icon: Hash },
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'blur', label: 'Blur', icon: ScanLine },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'crop', label: 'Crop', icon: Crop },
];

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  guideId?: string;
  /** Larger canvas: hide app chrome and side panels */
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  /** Step navigation while side panel is hidden */
  stepIndex?: number;
  stepCount?: number;
  onStepPrev?: () => void;
  onStepNext?: () => void;
  /** Toggle browser fullscreen on the editor shell (toolbar + canvas) */
  onToggleBrowserFullscreen?: () => void;
}

export function EditorToolbar({
  activeTool,
  onToolChange,
  guideId,
  focusMode = false,
  onToggleFocusMode,
  stepIndex = 0,
  stepCount = 0,
  onStepPrev,
  onStepNext,
  onToggleBrowserFullscreen,
}: EditorToolbarProps) {
  const [browserFs, setBrowserFs] = useState(false);

  useEffect(() => {
    const sync = () => setBrowserFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const handlePreview = () => {
    if (!guideId) return;
    window.open(`/api/guides/${guideId}/export?format=html&mode=standalone&scope=all`, '_blank');
  };

  const handleExport = async () => {
    if (!guideId) return;
    const res = await fetch(`/api/guides/${guideId}/export?format=html&mode=download&scope=all`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guide.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFiltered = async () => {
    if (!guideId) return;
    const res = await fetch(`/api/guides/${guideId}/export?format=html&mode=download&scope=exportable`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guide-all-steps.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const canStepNav = focusMode && stepCount > 1;

  return (
    <div className="border-b border-gray-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolChange(tool.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ring-1 ${
                active
                  ? 'bg-brand-500/10 text-brand-400 ring-brand-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 ring-transparent hover:ring-gray-700/50'
              }`}
              title={tool.label}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="hidden lg:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {onToggleFocusMode && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            className={`text-sm py-1.5 px-3 rounded-lg font-medium transition-colors ${
              focusMode
                ? 'bg-brand-600/25 text-brand-300 border border-brand-500/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent'
            }`}
            title={focusMode ? 'Show sidebars and header' : 'Hide sidebars for a larger canvas'}
          >
            {focusMode ? 'Exit focus' : 'Focus'}
          </button>
        )}
        {canStepNav && (
          <div className="flex items-center gap-1 border border-gray-800 rounded-lg overflow-hidden">
            <button
              type="button"
              disabled={stepIndex <= 0}
              onClick={onStepPrev}
              className="px-2.5 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none inline-flex items-center justify-center"
              title="Previous step"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} aria-hidden />
            </button>
            <span className="text-xs text-gray-500 px-1 tabular-nums">
              {stepIndex + 1}/{stepCount}
            </span>
            <button
              type="button"
              disabled={stepIndex >= stepCount - 1}
              onClick={onStepNext}
              className="px-2.5 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none inline-flex items-center justify-center"
              title="Next step"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
        {onToggleBrowserFullscreen && (
          <button
            type="button"
            onClick={onToggleBrowserFullscreen}
            className="text-sm py-1.5 px-3 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 font-medium border border-gray-800"
            title={browserFs ? 'Leave browser fullscreen (Esc)' : 'Use the whole monitor for the editor'}
          >
            {browserFs ? 'Exit full screen' : 'Full screen'}
          </button>
        )}
        <button
          onClick={handlePreview}
          className="btn-secondary text-sm py-1.5 px-3"
          title="Opens HTML with every step (ignores sidebar “Include in HTML export” checkboxes). Refresh if you just edited."
        >
          Preview
        </button>
        <button
          onClick={handleExport}
          className="btn-primary text-sm py-1.5 px-3"
          title="Download HTML including every step"
        >
          Export
        </button>
        <button
          type="button"
          onClick={handleExportFiltered}
          className="text-xs text-gray-500 hover:text-gray-300 py-1.5 px-2"
          title="Download HTML only for steps that have “Include in HTML export” checked in the sidebar"
        >
          Export (filtered)
        </button>
      </div>
    </div>
  );
}
