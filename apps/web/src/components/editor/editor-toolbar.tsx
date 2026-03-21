'use client';

export type Tool = 'select' | 'arrow' | 'callout' | 'badge' | 'highlight' | 'blur' | 'text';

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '⊹' },
  { id: 'arrow', label: 'Arrow', icon: '→' },
  { id: 'callout', label: 'Callout', icon: '💬' },
  { id: 'badge', label: 'Badge', icon: '①' },
  { id: 'highlight', label: 'Highlight', icon: '🟨' },
  { id: 'blur', label: 'Blur', icon: '▦' },
  { id: 'text', label: 'Text', icon: 'T' },
];

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  guideId?: string;
}

export function EditorToolbar({ activeTool, onToolChange, guideId }: EditorToolbarProps) {
  const handlePreview = () => {
    if (!guideId) return;
    window.open(`/api/guides/${guideId}/export?format=html&mode=standalone&scope=exportable`, '_blank');
  };

  const handleExport = async () => {
    if (!guideId) return;
    const res = await fetch(`/api/guides/${guideId}/export?format=html&mode=download&scope=exportable`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guide.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllSteps = async () => {
    if (!guideId) return;
    const res = await fetch(`/api/guides/${guideId}/export?format=html&mode=download&scope=all`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guide-all-steps.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-b border-gray-800 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTool === tool.id
                ? 'bg-brand-600/15 text-brand-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            title={tool.label}
          >
            <span>{tool.icon}</span>
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button onClick={handlePreview} className="btn-secondary text-sm py-1.5 px-3" title="Steps with “Include in HTML export” checked">
          Preview
        </button>
        <button onClick={handleExport} className="btn-primary text-sm py-1.5 px-3" title="Only steps included for export">
          Export
        </button>
        <button
          type="button"
          onClick={handleExportAllSteps}
          className="text-xs text-gray-500 hover:text-gray-300 py-1.5 px-2"
          title="Download HTML with every step, ignoring export checkboxes"
        >
          Export all steps
        </button>
      </div>
    </div>
  );
}
