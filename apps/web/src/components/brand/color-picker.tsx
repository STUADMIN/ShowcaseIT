'use client';

import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-lg border-2 border-gray-700 cursor-pointer transition-all hover:scale-105"
          style={{ backgroundColor: value }}
        />
        {isOpen && (
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setIsOpen(false)}
            className="absolute inset-0 opacity-0 w-10 h-10 cursor-pointer"
            autoFocus
          />
        )}
      </div>
      <div className="flex-1">
        <label className="text-sm text-gray-400 block mb-0.5">{label}</label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-24 outline-none focus:border-brand-600 font-mono"
        />
      </div>
    </div>
  );
}
