'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';

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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(index);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    setDragIndex(null);
    setDropTarget(null);
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTarget(null);
  };

  return (
    <div className="p-2 space-y-1">
      {steps.map((step, index) => {
        const isSelected = selectedStepId === step.id;
        const isDragging = dragIndex === index;
        const isDropTarget = dropTarget === index && dragIndex !== null && dragIndex !== index;

        return (
          <div
            key={step.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelect(step.id)}
            className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border-2 transition-all ${
              isDragging
                ? 'opacity-40 border-gray-700'
                : isDropTarget
                  ? 'border-brand-500 bg-brand-600/10'
                  : isSelected
                    ? 'bg-brand-600/10 border-brand-600/30'
                    : 'border-transparent hover:bg-gray-800/50'
            }`}
          >
            <div
              className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 transition-colors"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </div>

            <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              isSelected
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}>
              {step.order}
            </span>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  isSelected ? 'text-brand-300' : 'text-gray-300'
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

            <div className="flex-shrink-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (index > 0) onReorder(index, index - 1);
                }}
                disabled={index === 0}
                className="p-0.5 rounded text-gray-600 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors"
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (index < steps.length - 1) onReorder(index, index + 1);
                }}
                disabled={index === steps.length - 1}
                className="p-0.5 rounded text-gray-600 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600 transition-colors"
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(step.id);
              }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded hover:bg-red-400/10"
              title="Delete step"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
