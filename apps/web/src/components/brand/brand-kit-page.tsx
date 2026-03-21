'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ColorPicker } from './color-picker';
import { useApi, apiPost, apiPatch } from '@/hooks/use-api';

interface BrandKitData {
  id: string;
  name: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorBackground: string;
  colorForeground: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string | null;
}

const fontOptions = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins',
  'Lato', 'Playfair Display', 'Merriweather', 'Source Sans Pro', 'Raleway',
];

export function BrandKitPage() {
  const { data: brandKits, loading, refetch } = useApi<BrandKitData[]>({ url: '/api/brand-kits' });
  const [kit, setKit] = useState({
    id: '',
    name: 'My Brand',
    colorPrimary: '#2563EB',
    colorSecondary: '#7C3AED',
    colorAccent: '#F59E0B',
    colorBackground: '#FFFFFF',
    colorForeground: '#0F172A',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    logoUrl: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (brandKits?.length) {
      const bk = brandKits[0];
      setKit({
        id: bk.id,
        name: bk.name,
        colorPrimary: bk.colorPrimary,
        colorSecondary: bk.colorSecondary,
        colorAccent: bk.colorAccent,
        colorBackground: bk.colorBackground,
        colorForeground: bk.colorForeground,
        fontHeading: bk.fontHeading,
        fontBody: bk.fontBody,
        logoUrl: bk.logoUrl || '',
      });
    }
  }, [brandKits]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (kit.id) {
        await apiPatch(`/api/brand-kits/${kit.id}`, kit);
      } else {
        await apiPost('/api/brand-kits', { ...kit, workspaceId: '' });
      }
      refetch();
    } catch {}
    setSaving(false);
  }, [kit, refetch]);

  const updateColor = (key: string, value: string) => {
    setKit((prev) => ({ ...prev, [key]: value }));
  };

  const colorFields = [
    { key: 'colorPrimary', label: 'Primary' },
    { key: 'colorSecondary', label: 'Secondary' },
    { key: 'colorAccent', label: 'Accent' },
    { key: 'colorBackground', label: 'Background' },
    { key: 'colorForeground', label: 'Foreground' },
  ] as const;

  return (
    <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Brand Kit</h2>
              <p className="text-gray-400 mt-1">Configure your brand identity for all guides</p>
            </div>
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Brand Kit'}
            </button>
          </div>

          {loading ? (
            <div className="card p-16 text-center"><p className="text-gray-500">Loading brand kit...</p></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Brand Colors</h3>
                <div className="space-y-4">
                  {colorFields.map(({ key, label }) => (
                    <ColorPicker key={key} label={label} value={(kit as any)[key]} onChange={(val) => updateColor(key, val)} />
                  ))}
                </div>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Typography</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Heading Font</label>
                    <select value={kit.fontHeading} onChange={(e) => setKit((p) => ({ ...p, fontHeading: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600">
                      {fontOptions.map((f) => (<option key={f} value={f}>{f}</option>))}
                    </select>
                    <p className="mt-3 text-2xl text-gray-200" style={{ fontFamily: kit.fontHeading }}>The quick brown fox</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Body Font</label>
                    <select value={kit.fontBody} onChange={(e) => setKit((p) => ({ ...p, fontBody: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600">
                      {fontOptions.map((f) => (<option key={f} value={f}>{f}</option>))}
                    </select>
                    <p className="mt-3 text-sm text-gray-300" style={{ fontFamily: kit.fontBody }}>The quick brown fox jumps over the lazy dog.</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Logo</h3>
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors cursor-pointer">
                  {kit.logoUrl ? (
                    <img src={kit.logoUrl} alt="Logo" className="max-h-24 mx-auto" />
                  ) : (
                    <>
                      <div className="text-4xl mb-3">🖼</div>
                      <p className="text-sm text-gray-400">Click or drag to upload your logo</p>
                      <p className="text-xs text-gray-600 mt-1">PNG, SVG, or JPG up to 2MB</p>
                    </>
                  )}
                </div>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Preview</h3>
                <div className="rounded-xl p-6 border" style={{ backgroundColor: kit.colorBackground, borderColor: kit.colorPrimary + '30' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: kit.colorPrimary }} />
                    <h4 className="text-lg font-bold" style={{ color: kit.colorForeground, fontFamily: kit.fontHeading }}>{kit.name || 'Brand Name'}</h4>
                  </div>
                  <p className="text-sm mb-4" style={{ color: kit.colorForeground + 'CC', fontFamily: kit.fontBody }}>This is how your branded guide will look with your chosen colors and typography.</p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: kit.colorPrimary }}>Primary</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: kit.colorSecondary }}>Secondary</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: kit.colorAccent }}>Accent</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}
