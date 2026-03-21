'use client';

interface Step {
  id: string;
  order: number;
  title: string;
  description: string;
  screenshotUrl: string;
  includeInExport?: boolean;
}

interface StepPanelProps {
  steps: Step[];
  selectedStepId: string;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (id: string) => void;
}

export function StepPanel({ steps, selectedStepId, onSelect, onReorder, onDelete }: StepPanelProps) {
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-brand-600');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-brand-600');
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-brand-600');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  return (
    <div className="p-2 space-y-1">
      {steps.map((step, index) => (
        <div
          key={step.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onClick={() => onSelect(step.id)}
          className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 border-transparent transition-all ${
            selectedStepId === step.id
              ? 'bg-brand-600/10 border-brand-600/30'
              : 'hover:bg-gray-800/50'
          }`}
        >
          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            selectedStepId === step.id
              ? 'bg-brand-600 text-white'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {step.order}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium truncate ${
                selectedStepId === step.id ? 'text-brand-300' : 'text-gray-300'
              } ${step.includeInExport === false ? 'opacity-50' : ''}`}
            >
              {step.title}
              {step.includeInExport === false && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-600/90 font-normal">
                  export off
                </span>
              )}
            </p>
            <p className="text-xs text-gray-600 truncate mt-0.5">{step.description}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(step.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm p-1"
            title="Delete step"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
