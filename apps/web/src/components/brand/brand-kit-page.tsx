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
  guideCoverImageUrl: string | null;
}

const fontOptions = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins',
  'Lato', 'Playfair Display', 'Merriweather', 'Source Sans Pro', 'Raleway',
];

const MAX_UPLOAD_MB = 2;

function BrandAssetDropZone(props: {
  inputId: string;
  title: string;
  hint: string;
  previewUrl: string;
  aspectClass: string;
  uploading: boolean;
  onPickFiles: (files: FileList | null) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { inputId, title, hint, previewUrl, aspectClass, uploading, onPickFiles, onRemove, disabled } = props;
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {previewUrl && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !uploading) onPickFiles(e.dataTransfer.files);
        }}
        className={`block border-2 border-dashed rounded-xl overflow-hidden text-center transition-colors cursor-pointer ${
          dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-600'
        } ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => onPickFiles(e.target.files)}
        />
        <div className={`${aspectClass} flex flex-col items-center justify-center p-6`}>
          {uploading ? (
            <p className="text-sm text-gray-400">Uploading…</p>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <>
              <div className="text-4xl mb-3">🖼</div>
              <p className="text-sm text-gray-400">Click or drag to upload</p>
              <p className="text-xs text-gray-600 mt-1">{hint}</p>
            </>
          )}
        </div>
      </label>
    </div>
  );
}

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
    guideCoverImageUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

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
        guideCoverImageUrl: bk.guideCoverImageUrl || '',
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

  const uploadAsset = useCallback(
    async (kind: 'logo' | 'guideCover', file: File) => {
      if (!kit.id) {
        alert('Save your brand kit once (name & colors) before uploading images.');
        return;
      }
      const setBusy = kind === 'logo' ? setUploadingLogo : setUploadingCover;
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        const res = await fetch(`/api/brand-kits/${kit.id}/upload`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const updated = (await res.json()) as BrandKitData;
        setKit((prev) => ({
          ...prev,
          logoUrl: updated.logoUrl || '',
          guideCoverImageUrl: updated.guideCoverImageUrl || '',
        }));
        refetch();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusy(false);
      }
    },
    [kit.id, refetch]
  );

  const clearAsset = useCallback(
    async (field: 'logoUrl' | 'guideCoverImageUrl') => {
      if (!kit.id) return;
      try {
        await apiPatch(`/api/brand-kits/${kit.id}`, { [field]: null });
        setKit((prev) => ({ ...prev, [field]: '' }));
        refetch();
      } catch {}
    },
    [kit.id, refetch]
  );

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

  const onLogoFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void uploadAsset('logo', f);
  };

  const onCoverFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void uploadAsset('guideCover', f);
  };

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
                    <ColorPicker key={key} label={label} value={(kit as Record<string, string>)[key]} onChange={(val) => updateColor(key, val)} />
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
              <BrandAssetDropZone
                inputId="brand-logo-upload"
                title="Logo"
                hint={`PNG, SVG, or JPG up to ${MAX_UPLOAD_MB}MB`}
                previewUrl={kit.logoUrl}
                aspectClass="min-h-[140px]"
                uploading={uploadingLogo}
                onPickFiles={onLogoFiles}
                onRemove={() => void clearAsset('logoUrl')}
              />
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
              <div className="lg:col-span-2">
                <BrandAssetDropZone
                  inputId="brand-guide-cover-upload"
                  title="Guide cover image"
                  hint={`Shown on guide cards when the first step has no screenshot. PNG, JPG, or WebP up to ${MAX_UPLOAD_MB}MB. Recommended 16:9.`}
                  previewUrl={kit.guideCoverImageUrl}
                  aspectClass="aspect-video max-h-[280px]"
                  uploading={uploadingCover}
                  onPickFiles={onCoverFiles}
                  onRemove={() => void clearAsset('guideCoverImageUrl')}
                />
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}
