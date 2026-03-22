'use client';

import { Search, X } from 'lucide-react';

export interface ListSearchInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ListSearchInput({
  id,
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: ListSearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        strokeWidth={2}
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-gray-700 bg-gray-900/80 py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder:text-gray-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition-shadow"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
