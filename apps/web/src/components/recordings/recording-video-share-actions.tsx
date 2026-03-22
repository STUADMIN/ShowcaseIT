'use client';

import { useMemo, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

function escapeAttr(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function buildVideoEmbedHtml(videoUrl: string): string {
  const src = escapeAttr(videoUrl);
  return `<video controls width="100%" style="max-width:960px" src="${src}" playsInline preload="metadata">
  Your browser does not support the video tag.
</video>`;
}

export function RecordingVideoShareActions({ videoUrl }: { videoUrl: string }) {
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const embedHtml = useMemo(() => buildVideoEmbedHtml(videoUrl), [videoUrl]);

  const copy = async (kind: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(kind === 'link' ? videoUrl : embedHtml);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {copied ? (
        <span className="text-xs text-green-400 font-medium px-1">
          {copied === 'link' ? 'Link copied' : 'Embed code copied'}
        </span>
      ) : null}
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-medium"
      >
        <ExternalLink className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Open video
      </a>
      <button
        type="button"
        onClick={() => void copy('link')}
        className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors font-medium"
      >
        <Copy className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Copy link
      </button>
      <button
        type="button"
        onClick={() => void copy('embed')}
        className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg bg-gray-800 border border-gray-600 text-brand-300 hover:text-brand-200 hover:border-brand-500/40 transition-colors font-medium"
        title="HTML &lt;video&gt; snippet for your site or CMS"
      >
        <Copy className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Copy embed HTML
      </button>
    </div>
  );
}
