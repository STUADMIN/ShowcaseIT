'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TextAnnotationModalProps {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  /** Always uses a textarea; kept for backwards compat. */
  multiline?: boolean;
}

/**
 * In-app text entry for guide annotations (replaces window.prompt).
 */
export function TextAnnotationModal({
  open,
  title,
  description,
  placeholder,
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel = 'Add',
  multiline = false,
}: TextAnnotationModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="text-annotation-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-gray-950/85 backdrop-blur-md"
        aria-label="Dismiss"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-gray-700/90 bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-brand-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 id="text-annotation-modal-title" className="text-lg font-semibold text-gray-100">
            {title}
          </h2>
          {description ? <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{description}</p> : null}
        </div>
        <div className="px-6 py-5">
          <label className="sr-only" htmlFor="text-annotation-modal-input">
            {placeholder || title}
          </label>
          <textarea
            id="text-annotation-modal-input"
            ref={textareaRef}
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-y min-h-[100px] max-h-[50vh] rounded-xl border border-gray-700 bg-gray-950/80 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition-shadow"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onConfirm();
              }
            }}
          />
          <p className="text-xs text-gray-600 mt-2">
            Press <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-400">Enter</kbd> for a new line.{' '}
            <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-400">Ctrl</kbd>+
            <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-400">Enter</kbd> to save.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-6 py-4 bg-gray-950/40 rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary px-5 py-2.5 text-sm rounded-xl">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
