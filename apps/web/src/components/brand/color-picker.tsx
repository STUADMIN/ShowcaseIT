'use client';

import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react';
import {
  brandPaintCss,
  buildSimpleLinearGradient,
  isCssGradient,
  parseSimpleLinearGradient,
  sanitizeGradientCss,
  solidBrandHex,
} from '@/lib/brand/brand-color-value';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** When false, only solid hex (e.g. foreground text color). Default true. */
  allowGradient?: boolean;
}

const ANGLE_OPTIONS = [90, 135, 180, 270] as const;

export function ColorPicker({ label, value, onChange, allowGradient = true }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [mode, setMode] = useState<'solid' | 'gradient'>(() =>
    allowGradient && isCssGradient(value) ? 'gradient' : 'solid'
  );
  const [customGradient, setCustomGradient] = useState('');
  const [useCustomGradient, setUseCustomGradient] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseSimpleLinearGradient(value), [value]);

  const [gAngle, setGAngle] = useState(parsed?.angle ?? 135);
  const [g1, setG1] = useState(parsed?.color1 ?? '#2563EB');
  const [g2, setG2] = useState(parsed?.color2 ?? '#7C3AED');

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!allowGradient) {
      setMode('solid');
      return;
    }
    if (isCssGradient(value)) {
      setMode('gradient');
      const p = parseSimpleLinearGradient(value);
      if (p) {
        setGAngle(p.angle);
        setG1(p.color1);
        setG2(p.color2);
        setUseCustomGradient(false);
      } else {
        setUseCustomGradient(true);
        setCustomGradient(value.trim());
      }
    } else {
      setMode('solid');
      setUseCustomGradient(false);
    }
  }, [value, allowGradient]);

  const applySimpleGradient = (angle: number, c1: string, c2: string) => {
    onChange(buildSimpleLinearGradient(angle, c1, c2));
  };

  const handleSolidInputChange = (val: string) => {
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  const swatchStyle: CSSProperties = {
    background: brandPaintCss(value, '#888888'),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 pt-6">
          <button
            type="button"
            onClick={() => mode === 'solid' && setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-lg border-2 border-gray-700 cursor-pointer transition-all hover:scale-105"
            style={swatchStyle}
            title={mode === 'gradient' ? 'Gradient preview' : 'Open color picker'}
            disabled={mode === 'gradient'}
          />
          {mode === 'solid' && isOpen && (
            <input
              ref={inputRef}
              type="color"
              value={solidBrandHex(value, '#888888')}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setIsOpen(false)}
              className="absolute inset-0 opacity-0 w-10 h-10 cursor-pointer"
              autoFocus
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-sm text-gray-400">{label}</label>
            {allowGradient ? (
              <div className="flex rounded-lg border border-gray-700 p-0.5 bg-gray-900/80 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('solid');
                    const hex = solidBrandHex(value, inputValue.startsWith('#') ? inputValue : '#2563EB');
                    onChange(hex);
                    setInputValue(hex);
                  }}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    mode === 'solid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('gradient');
                    if (!isCssGradient(value)) {
                      const base = solidBrandHex(value, '#2563EB');
                      applySimpleGradient(gAngle, base, g2);
                    }
                  }}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    mode === 'gradient' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Gradient
                </button>
              </div>
            ) : null}
          </div>

          {mode === 'solid' || !allowGradient ? (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleSolidInputChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-full max-w-[11rem] outline-none focus:border-brand-600 font-mono"
              placeholder="#2563EB"
              spellCheck={false}
            />
          ) : (
            <div className="space-y-3">
              {!useCustomGradient ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={g1}
                      onChange={(e) => {
                        const v = e.target.value;
                        setG1(v);
                        applySimpleGradient(gAngle, v, g2);
                      }}
                      className="h-9 w-12 cursor-pointer rounded border border-gray-600 bg-gray-900"
                      title="Start color"
                    />
                    <input
                      type="color"
                      value={g2}
                      onChange={(e) => {
                        const v = e.target.value;
                        setG2(v);
                        applySimpleGradient(gAngle, g1, v);
                      }}
                      className="h-9 w-12 cursor-pointer rounded border border-gray-600 bg-gray-900"
                      title="End color"
                    />
                    <select
                      value={gAngle}
                      onChange={(e) => {
                        const a = Number(e.target.value);
                        setGAngle(a);
                        applySimpleGradient(a, g1, g2);
                      }}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-brand-600"
                    >
                      {ANGLE_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}°
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={value}
                    className="bg-gray-900/80 border border-gray-700 rounded px-2 py-1.5 text-[11px] text-gray-500 w-full font-mono"
                    spellCheck={false}
                  />
                </>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomGradient((u) => !u);
                    if (!useCustomGradient) {
                      setCustomGradient(value);
                    } else {
                      applySimpleGradient(gAngle, g1, g2);
                    }
                  }}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  {useCustomGradient ? 'Use simple 2-color gradient' : 'Custom CSS gradient…'}
                </button>
              </div>

              {useCustomGradient ? (
                <div>
                  <textarea
                    value={customGradient}
                    onChange={(e) => setCustomGradient(e.target.value)}
                    onBlur={() => {
                      const s = sanitizeGradientCss(customGradient);
                      if (s) onChange(s);
                    }}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-[11px] text-gray-300 font-mono outline-none focus:border-brand-600 resize-y min-h-[52px]"
                    placeholder="linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    linear-gradient or radial-gradient only. PDF export uses the first color stop as a flat fill.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
