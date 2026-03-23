'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Facebook, ImagePlus, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { IconTile } from '@/components/ui/icon-tile';
import { AppShell } from '@/components/layout/app-shell';
import { ColorPicker } from './color-picker';
import { useApi, apiPost, apiPatch } from '@/hooks/use-api';
import {
  BRAND_KIT_FONT_OPTIONS,
  brandKitFontStackCss,
  brandKitGoogleFontsStylesheetHref,
} from '@/lib/brand-kit-fonts';
import { brandPaintCss, solidBrandHex } from '@/lib/brand/brand-color-value';
import {
  SOCIAL_PLATFORM_IDS,
  SOCIAL_PLATFORM_LABELS,
  parseSocialPlatformAssets,
  type SocialPlatformAssetsMap,
  type SocialPlatformId,
} from '@/lib/brand/social-platform-assets';

const SOCIAL_ICONS: Record<SocialPlatformId, LucideIcon> = {
  youtube: Youtube,
  linkedin: Linkedin,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
};

function nextSocialAssetsAfterClear(
  map: SocialPlatformAssetsMap,
  platform: SocialPlatformId,
  asset: 'logo' | 'banner'
): SocialPlatformAssetsMap {
  const sp: SocialPlatformAssetsMap = { ...map };
  const row = { ...(sp[platform] ?? {}) };
  if (asset === 'logo') {
    delete row.logoUrl;
  } else {
    delete row.bannerUrl;
  }
  if (!row.logoUrl && !row.bannerUrl) {
    delete sp[platform];
  } else {
    sp[platform] = row;
  }
  return sp;
}

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
  exportBannerDocumentUrl?: string | null;
  exportBannerSocialUrl?: string | null;
  socialPlatformAssets?: unknown;
}

/** Local editor shape (empty string instead of null for cleared image fields). */
type BrandKitEditorState = Omit<
  BrandKitData,
  | 'logoUrl'
  | 'guideCoverImageUrl'
  | 'exportBannerDocumentUrl'
  | 'exportBannerSocialUrl'
  | 'socialPlatformAssets'
> & {
  logoUrl: string;
  guideCoverImageUrl: string;
  exportBannerDocumentUrl: string;
  exportBannerSocialUrl: string;
  socialPlatformAssets: SocialPlatformAssetsMap;
};

const MAX_UPLOAD_MB = 2;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function fileTooLargeCopy(file: File): string {
  const label = file.name?.trim() ? `“${file.name}”` : 'This file';
  return `${label} is ${formatFileSize(file.size)}. The limit is ${MAX_UPLOAD_MB} MB per image.\n\nTry exporting a smaller version, lowering JPEG/WebP quality in your editor, or compressing it with a tool like Squoosh (squoosh.app), then upload again.`;
}

/** Turn API / generic errors into clearer copy when we recognize them */
function friendlyUploadError(file: File | null, raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('2mb') && lower.includes('smaller')) {
    return file ? fileTooLargeCopy(file) : `That file is over the ${MAX_UPLOAD_MB} MB limit.\n\nUse a smaller or more compressed image and try again.`;
  }
  if (lower.includes('must be an image')) {
    return 'That file doesn’t look like a supported image. Use PNG, JPG, WebP, or SVG.';
  }
  return raw;
}

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
              <div className="mb-3">
                <IconTile icon={ImagePlus} size="lg" variant="muted" />
              </div>
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
  const [kit, setKit] = useState<BrandKitEditorState>({
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
    exportBannerDocumentUrl: '',
    exportBannerSocialUrl: '',
    socialPlatformAssets: {},
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingExportDocBanner, setUploadingExportDocBanner] = useState(false);
  const [uploadingExportSocialBanner, setUploadingExportSocialBanner] = useState(false);
  /** Keys like `linkedin:logo` */
  const [socialUploading, setSocialUploading] = useState<Record<string, boolean>>({});
  const [brandBanner, setBrandBanner] = useState<{ tone: 'error' | 'warning'; message: string } | null>(null);

  /** Load Google Fonts for dropdown previews (otherwise the browser falls back and “Inter” may not match). */
  useEffect(() => {
    const idCss = 'si-brand-kit-fonts-css';
    const idPcG = 'si-brand-kit-fonts-pc-google';
    const idPcGs = 'si-brand-kit-fonts-pc-gstatic';
    if (document.getElementById(idCss)) return () => {};

    const pc1 = document.createElement('link');
    pc1.id = idPcG;
    pc1.rel = 'preconnect';
    pc1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(pc1);

    const pc2 = document.createElement('link');
    pc2.id = idPcGs;
    pc2.rel = 'preconnect';
    pc2.href = 'https://fonts.gstatic.com';
    pc2.crossOrigin = 'anonymous';
    document.head.appendChild(pc2);

    const link = document.createElement('link');
    link.id = idCss;
    link.rel = 'stylesheet';
    link.href = brandKitGoogleFontsStylesheetHref();
    document.head.appendChild(link);

    return () => {
      document.getElementById(idCss)?.remove();
      document.getElementById(idPcG)?.remove();
      document.getElementById(idPcGs)?.remove();
    };
  }, []);

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
        exportBannerDocumentUrl: bk.exportBannerDocumentUrl || '',
        exportBannerSocialUrl: bk.exportBannerSocialUrl || '',
        socialPlatformAssets: parseSocialPlatformAssets(bk.socialPlatformAssets),
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
    async (
      kind: 'logo' | 'guideCover' | 'exportBannerDocument' | 'exportBannerSocial',
      file: File
    ) => {
      setBrandBanner(null);
      if (!kit.id) {
        setBrandBanner({
          tone: 'warning',
          message:
            'Save your brand kit first (click **Save Brand Kit** at the top) so we know which workspace to attach images to. Then you can upload a logo, cover, or export banners.',
        });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setBrandBanner({ tone: 'error', message: fileTooLargeCopy(file) });
        return;
      }
      const setBusy =
        kind === 'logo'
          ? setUploadingLogo
          : kind === 'guideCover'
            ? setUploadingCover
            : kind === 'exportBannerDocument'
              ? setUploadingExportDocBanner
              : setUploadingExportSocialBanner;
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        const res = await fetch(`/api/brand-kits/${kit.id}/upload`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.error === 'string' ? err.error : `HTTP ${res.status}`);
        }
        const updated = (await res.json()) as BrandKitData;
        setKit((prev) => ({
          ...prev,
          logoUrl: updated.logoUrl ?? prev.logoUrl,
          guideCoverImageUrl: updated.guideCoverImageUrl ?? prev.guideCoverImageUrl,
          exportBannerDocumentUrl: updated.exportBannerDocumentUrl ?? prev.exportBannerDocumentUrl,
          exportBannerSocialUrl: updated.exportBannerSocialUrl ?? prev.exportBannerSocialUrl,
          socialPlatformAssets:
            updated.socialPlatformAssets != null
              ? parseSocialPlatformAssets(updated.socialPlatformAssets)
              : prev.socialPlatformAssets,
        }));
        /** Clear before refetch: refetch() sets useApi `loading` and unmounts the grid; leaving uploading=true stuck the UI. */
        setBusy(false);
        setBrandBanner(null);
        void refetch();
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Something went wrong while uploading. Check your connection and try again.';
        setBrandBanner({ tone: 'error', message: friendlyUploadError(file, raw) });
      } finally {
        setBusy(false);
      }
    },
    [kit.id, refetch]
  );

  const uploadSocialPlatformAsset = useCallback(
    async (platform: SocialPlatformId, asset: 'logo' | 'banner', file: File) => {
      setBrandBanner(null);
      if (!kit.id) {
        setBrandBanner({
          tone: 'warning',
          message:
            'Save your brand kit first (click **Save Brand Kit** at the top) so we know which workspace to attach images to.',
        });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setBrandBanner({ tone: 'error', message: fileTooLargeCopy(file) });
        return;
      }
      const busyKey = `${platform}:${asset}`;
      setSocialUploading((u) => ({ ...u, [busyKey]: true }));
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', asset === 'logo' ? 'socialLogo' : 'socialBanner');
        fd.append('platform', platform);
        const res = await fetch(`/api/brand-kits/${kit.id}/upload`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.error === 'string' ? err.error : `HTTP ${res.status}`);
        }
        const updated = (await res.json()) as BrandKitData;
        setKit((prev) => ({
          ...prev,
          socialPlatformAssets:
            updated.socialPlatformAssets != null
              ? parseSocialPlatformAssets(updated.socialPlatformAssets)
              : prev.socialPlatformAssets,
        }));
        setSocialUploading((u) => ({ ...u, [busyKey]: false }));
        setBrandBanner(null);
        void refetch();
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Something went wrong while uploading. Check your connection and try again.';
        setBrandBanner({ tone: 'error', message: friendlyUploadError(file, raw) });
      } finally {
        setSocialUploading((u) => ({ ...u, [busyKey]: false }));
      }
    },
    [kit.id, refetch]
  );

  const clearSocialPlatformAsset = useCallback(
    async (platform: SocialPlatformId, asset: 'logo' | 'banner') => {
      if (!kit.id) return;
      const nextSp = nextSocialAssetsAfterClear(kit.socialPlatformAssets, platform, asset);
      try {
        await apiPatch(`/api/brand-kits/${kit.id}`, { socialPlatformAssets: nextSp });
        setKit((prev) => ({ ...prev, socialPlatformAssets: nextSp }));
        refetch();
      } catch {}
    },
    [kit.id, kit.socialPlatformAssets, refetch]
  );

  const clearAsset = useCallback(
    async (
      field: 'logoUrl' | 'guideCoverImageUrl' | 'exportBannerDocumentUrl' | 'exportBannerSocialUrl'
    ) => {
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

  const onExportDocBannerFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void uploadAsset('exportBannerDocument', f);
  };

  const onExportSocialBannerFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void uploadAsset('exportBannerSocial', f);
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
              {brandBanner && (
                <div
                  className="lg:col-span-2 rounded-xl border px-4 py-3 text-sm flex gap-3 justify-between items-start"
                  role="alert"
                  style={
                    brandBanner.tone === 'error'
                      ? { borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(69,10,10,0.35)' }
                      : { borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(66,52,10,0.35)' }
                  }
                >
                  <p
                    className={brandBanner.tone === 'error' ? 'text-red-100/95' : 'text-amber-100/95'}
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {brandBanner.message.split('**').map((part, i) =>
                      i % 2 === 1 ? (
                        <strong key={i} className="font-semibold text-white">
                          {part}
                        </strong>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBrandBanner(null)}
                    className="shrink-0 text-xs text-gray-400 hover:text-white underline-offset-2 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Brand Colors</h3>
                <div className="space-y-4">
                  {colorFields.map(({ key, label }) => (
                    <ColorPicker
                      key={key}
                      label={label}
                      value={(kit as unknown as Record<string, string>)[key]}
                      onChange={(val) => updateColor(key, val)}
                      allowGradient={key !== 'colorForeground'}
                    />
                  ))}
                </div>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-6">Typography</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Heading Font</label>
                    <select value={kit.fontHeading} onChange={(e) => setKit((p) => ({ ...p, fontHeading: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600">
                      {BRAND_KIT_FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <p
                      className="mt-3 text-2xl text-gray-200"
                      style={{ fontFamily: brandKitFontStackCss(kit.fontHeading) }}
                    >
                      The quick brown fox
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Body Font</label>
                    <select value={kit.fontBody} onChange={(e) => setKit((p) => ({ ...p, fontBody: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600">
                      {BRAND_KIT_FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <p
                      className="mt-3 text-sm text-gray-300"
                      style={{ fontFamily: brandKitFontStackCss(kit.fontBody) }}
                    >
                      The quick brown fox jumps over the lazy dog.
                    </p>
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
                <div
                  className="rounded-xl p-6 border"
                  style={{
                    background: brandPaintCss(kit.colorBackground, '#FFFFFF'),
                    borderColor: `${solidBrandHex(kit.colorPrimary, '#2563EB')}30`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ background: brandPaintCss(kit.colorPrimary, '#2563EB') }}
                    />
                    <h4
                      className="text-lg font-bold"
                      style={{
                        color: kit.colorForeground,
                        fontFamily: brandKitFontStackCss(kit.fontHeading),
                      }}
                    >
                      {kit.name || 'Brand Name'}
                    </h4>
                  </div>
                  <p
                    className="text-sm mb-4"
                    style={{
                      color: `${solidBrandHex(kit.colorForeground, '#0F172A')}CC`,
                      fontFamily: brandKitFontStackCss(kit.fontBody),
                    }}
                  >
                    This is how your branded guide will look with your chosen colors and typography.
                  </p>
                  <div className="flex gap-2">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{ background: brandPaintCss(kit.colorPrimary, '#2563EB') }}
                    >
                      Primary
                    </span>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{ background: brandPaintCss(kit.colorSecondary, '#7C3AED') }}
                    >
                      Secondary
                    </span>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{ background: brandPaintCss(kit.colorAccent, '#F59E0B') }}
                    >
                      Accent
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <BrandAssetDropZone
                  inputId="brand-guide-cover-upload"
                  title="Guide cover image"
                  hint={`Default thumbnail on the Guides list when set (preferred over the first step image). PNG, JPG, or WebP up to ${MAX_UPLOAD_MB}MB. Recommended 16:9.`}
                  previewUrl={kit.guideCoverImageUrl}
                  aspectClass="aspect-video max-h-[280px]"
                  uploading={uploadingCover}
                  onPickFiles={onCoverFiles}
                  onRemove={() => void clearAsset('guideCoverImageUrl')}
                />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Export banners</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Optional images for HTML, PDF, and Word exports. The document banner appears under the guide cover
                    when both are set. The default social image is used for link previews (
                    <code className="text-gray-400">og:image</code>) unless you export with{' '}
                    <code className="text-gray-400">?social=linkedin</code> (values: youtube, linkedin, x, facebook,
                    instagram) to use that platform&apos;s banner from the section below. Recommended default banner size
                    about <strong className="text-gray-300">1200×627</strong>.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <BrandAssetDropZone
                    inputId="brand-export-banner-doc-upload"
                    title="Document export banner"
                    hint={`Shown in exported guides below the cover. PNG, JPG, or WebP up to ${MAX_UPLOAD_MB}MB.`}
                    previewUrl={kit.exportBannerDocumentUrl}
                    aspectClass="aspect-[21/9] max-h-[200px]"
                    uploading={uploadingExportDocBanner}
                    onPickFiles={onExportDocBannerFiles}
                    onRemove={() => void clearAsset('exportBannerDocumentUrl')}
                  />
                  <BrandAssetDropZone
                    inputId="brand-export-banner-social-upload"
                    title="Social / link preview"
                    hint={`~1200×627 recommended. Falls back to the document banner in HTML if unset. Up to ${MAX_UPLOAD_MB}MB.`}
                    previewUrl={kit.exportBannerSocialUrl}
                    aspectClass="aspect-[1200/627] max-h-[200px]"
                    uploading={uploadingExportSocialBanner}
                    onPickFiles={onExportSocialBannerFiles}
                    onRemove={() => void clearAsset('exportBannerSocialUrl')}
                  />
                </div>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Social media assets</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Optional <strong className="text-gray-300">logo</strong> and{' '}
                    <strong className="text-gray-300">link-preview banner</strong> for each network. Defaults fall back to
                    the main Logo and default social banner above. Use them when exporting with{' '}
                    <code className="text-gray-400">?social=…</code> for the right{' '}
                    <code className="text-gray-400">og:image</code> and PDF/Word header logo.
                  </p>
                </div>
                <div className="space-y-6">
                  {SOCIAL_PLATFORM_IDS.map((pid) => {
                    const Icon = SOCIAL_ICONS[pid];
                    const row = kit.socialPlatformAssets[pid];
                    const logoUrl = row?.logoUrl ?? '';
                    const bannerUrl = row?.bannerUrl ?? '';
                    return (
                      <div
                        key={pid}
                        className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:p-6 space-y-4"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-gray-300 shrink-0" aria-hidden />
                          <h4 className="text-base font-semibold text-gray-100">{SOCIAL_PLATFORM_LABELS[pid]}</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <BrandAssetDropZone
                            inputId={`brand-social-logo-${pid}`}
                            title="Logo"
                            hint={`Square or wide logo, up to ${MAX_UPLOAD_MB}MB`}
                            previewUrl={logoUrl}
                            aspectClass="min-h-[120px]"
                            uploading={socialUploading[`${pid}:logo`] ?? false}
                            onPickFiles={(files) => {
                              const f = files?.[0];
                              if (f) void uploadSocialPlatformAsset(pid, 'logo', f);
                            }}
                            onRemove={() => void clearSocialPlatformAsset(pid, 'logo')}
                          />
                          <BrandAssetDropZone
                            inputId={`brand-social-banner-${pid}`}
                            title="Link preview banner"
                            hint={`~1200×627 recommended, up to ${MAX_UPLOAD_MB}MB`}
                            previewUrl={bannerUrl}
                            aspectClass="aspect-[1200/627] max-h-[180px]"
                            uploading={socialUploading[`${pid}:banner`] ?? false}
                            onPickFiles={(files) => {
                              const f = files?.[0];
                              if (f) void uploadSocialPlatformAsset(pid, 'banner', f);
                            }}
                            onRemove={() => void clearSocialPlatformAsset(pid, 'banner')}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
    </AppShell>
  );
}
