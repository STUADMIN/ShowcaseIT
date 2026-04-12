import type { Guide, BrandKit } from './types';
import { resolveLinkPreviewImageUrl } from '@/lib/brand/social-platform-assets';
import type { SocialPlatformId } from '@/lib/brand/social-platform-assets';
import { brandPaintCss, solidBrandHex } from '@/lib/brand/brand-color-value';
import { computeArrowParts } from '@/lib/editor/arrow-geometry';
import { circleFillRgba, resolveCircleStroke, resolveHighlightColor } from '@/lib/editor/circle-colors';
import { exportCalloutTailMarkup, parseCalloutTail } from '@/lib/editor/callout-tail';
import { blurOverlayAlpha, blurRadiusPx, clampBlurIntensity } from '@/lib/editor/blur-intensity';

export interface HtmlExportOptions {
  guide: Guide;
  brandKit?: BrandKit;
  embedMode: 'standalone' | 'iframe';
  includeAnimations: boolean;
  /**
   * When false, returns `<link>` + `<style>` + wrapped body content only (for CMS embed).
   * Uses `.si-export-root` so the same CSS works without a document `<body>`.
   */
  includeDocumentShell?: boolean;
  /**
   * When set, `og:image` prefers that platform's banner from the brand kit, then default social banner, then document banner.
   * Use export URL `?social=linkedin` (youtube | linkedin | x | facebook | instagram).
   */
  linkPreviewPlatform?: SocialPlatformId | null;
  /** When true, exports use neutral system fonts, no cover/banner/footer, and a plain colour scheme. */
  noBranding?: boolean;
}

export function generateHtmlExport(options: HtmlExportOptions): string {
  const {
    guide,
    brandKit,
    embedMode,
    includeAnimations,
    includeDocumentShell = true,
    linkPreviewPlatform = null,
    noBranding = false,
  } = options;

  const colors = noBranding
    ? { primary: '#374151', secondary: '#6B7280', accent: '#9CA3AF', background: '#FFFFFF', foreground: '#111827' }
    : (brandKit?.colors ?? {
        primary: '#2563EB',
        secondary: '#7C3AED',
        accent: '#F59E0B',
        background: '#FFFFFF',
        foreground: '#0F172A',
      });

  const solid = {
    primary: solidBrandHex(colors.primary, '#2563EB'),
    secondary: solidBrandHex(colors.secondary, '#7C3AED'),
    accent: solidBrandHex(colors.accent, '#F59E0B'),
    background: solidBrandHex(colors.background, '#FFFFFF'),
    foreground: solidBrandHex(colors.foreground, '#0F172A'),
  };
  const paint = {
    primary: brandPaintCss(colors.primary, solid.primary),
    secondary: brandPaintCss(colors.secondary, solid.secondary),
    accent: brandPaintCss(colors.accent, solid.accent),
    background: brandPaintCss(colors.background, solid.background),
  };

  const fonts = noBranding
    ? { heading: 'system-ui', body: 'system-ui' }
    : (brandKit?.fonts ?? { heading: 'Inter', body: 'Inter' });

  const stepsHtml = guide.steps
    .map(
      (step, i) => `
    <div class="step" id="step-${i + 1}">
      <div class="step-header">
        <span class="step-number">${i + 1}</span>
        <div class="step-header-text">
          <h3 class="step-title">${escapeHtml(step.title)}</h3>
          ${step.description?.trim() ? `<div class="step-desc">${descriptionToExportHtml(step.description)}</div>` : ''}
        </div>
      </div>
      ${
        step.screenshotUrl
          ? `<div class="step-image-wrapper">
              <img src="${escapeHtml(step.screenshotUrl)}" alt="${escapeHtml(step.title)}" class="step-image" loading="lazy" />
              ${renderAnnotationsHtml(step.annotations)}
              ${renderBlurRegionsHtml(step.blurRegions)}
              ${includeAnimations && step.mousePosition ? renderMouseCursorHtml(step.mousePosition) : ''}
            </div>`
          : ''
      }
    </div>`
    )
    .join('\n');

  const mouseAnimationCss = includeAnimations
    ? `
    .mouse-cursor {
      position: absolute;
      width: 24px;
      height: 24px;
      pointer-events: none;
      z-index: 10;
      transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .mouse-cursor::before {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-left: 8px solid var(--color-primary);
      border-right: 8px solid transparent;
      border-bottom: 14px solid transparent;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .mouse-cursor.clicking::after {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      width: 40px;
      height: 40px;
      border: 2px solid var(--color-primary);
      border-radius: 50%;
      animation: click-ripple 0.6s ease-out;
      opacity: 0;
    }
    @keyframes click-ripple {
      0% { transform: scale(0.5); opacity: 0.8; }
      100% { transform: scale(1.5); opacity: 0; }
    }`
    : '';

  const coverUrl = noBranding ? '' : (brandKit?.guideCoverImageUrl?.trim() ?? '');
  const coverHtml =
    coverUrl && coverUrl.length > 0
      ? `<section class="si-export-cover" aria-label="Guide cover"><img src="${escapeHtml(coverUrl)}" alt="" /></section>`
      : '';

  const docBannerUrl = noBranding ? '' : (brandKit?.exportBannerDocumentUrl?.trim() ?? '');
  const bannerHtml =
    docBannerUrl && docBannerUrl.length > 0
      ? `<section class="si-export-banner" aria-label="Brand banner"><img src="${escapeHtml(docBannerUrl)}" alt="" role="presentation" /></section>`
      : '';
  const ogImageUrl = noBranding
    ? ''
    : resolveLinkPreviewImageUrl(
        brandKit?.socialPlatformAssets,
        linkPreviewPlatform,
        brandKit?.exportBannerSocialUrl,
        brandKit?.exportBannerDocumentUrl
      ).trim();
  const ogImageMeta =
    includeDocumentShell && ogImageUrl.length > 0
      ? `  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${ogImageMeta}  <title>${escapeHtml(guide.title)}</title>
  ${noBranding ? '' : `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500&display=swap" rel="stylesheet" />`}
  <style>
    :root {
      --color-primary: ${solid.primary};
      --color-secondary: ${solid.secondary};
      --color-accent: ${solid.accent};
      --color-bg: ${solid.background};
      --color-bg-solid: ${solid.background};
      --color-fg: ${solid.foreground};
      --paint-primary: ${paint.primary};
      --paint-secondary: ${paint.secondary};
      --paint-accent: ${paint.accent};
      --paint-bg: ${paint.background};
      --font-heading: '${fonts.heading}', system-ui, sans-serif;
      --font-body: '${fonts.body}', system-ui, sans-serif;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body, .si-export-root {
      font-family: var(--font-body);
      background: var(--paint-bg);
      color: var(--color-fg);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      ${embedMode === 'iframe' ? 'padding: 24px;' : 'padding: 56px 24px 80px; max-width: 880px; margin: 0 auto;'}
    }

    /* ── Guide header ─────────────────────────────── */
    .guide-header {
      margin-bottom: 40px;
      padding-bottom: 32px;
      border-bottom: 1px solid color-mix(in srgb, var(--color-fg) 10%, transparent);
      ${embedMode === 'standalone' ? 'text-align: center;' : ''}
    }
    .guide-title {
      font-family: var(--font-heading);
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--color-fg);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .guide-description {
      font-size: 1.05rem;
      color: color-mix(in srgb, var(--color-fg) 55%, transparent);
      max-width: 640px;
      ${embedMode === 'standalone' ? 'margin: 0 auto;' : ''}
    }
    /* ── Step cards ────────────────────────────────── */
    .step {
      margin-bottom: 40px;
      padding: 28px 32px 32px;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--color-fg) 8%, transparent);
      background: color-mix(in srgb, var(--color-primary) 2%, var(--color-bg-solid));
      transition: box-shadow 0.2s;
    }
    .step:hover {
      box-shadow: 0 4px 32px color-mix(in srgb, var(--color-primary) 6%, transparent);
    }
    .step:target {
      box-shadow: 0 0 0 2px var(--color-primary), 0 4px 32px color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    .step-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 20px;
    }
    .step-header-text {
      flex: 1;
      min-width: 0;
    }
    .step-number {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--paint-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      margin-top: 2px;
    }
    .step-title {
      font-family: var(--font-heading);
      font-size: 1.15rem;
      font-weight: 600;
      line-height: 1.35;
      margin-bottom: 4px;
    }
    .step-desc {
      color: color-mix(in srgb, var(--color-fg) 55%, transparent);
      font-size: 0.9rem;
      line-height: 1.65;
    }
    .step-desc strong {
      color: var(--color-fg);
      font-weight: 600;
    }

    /* ── Screenshot container ─────────────────────── */
    .step-image-wrapper {
      position: relative;
      border-radius: 10px;
      overflow: visible;
      border: 1px solid color-mix(in srgb, var(--color-fg) 8%, transparent);
      box-shadow: 0 2px 16px rgba(0,0,0,0.04);
    }
    .step-image-wrapper > img {
      border-radius: 10px;
    }
    .step-image {
      width: 100%;
      display: block;
    }

    /* ── Annotations ──────────────────────────────── */
    .blur-region {
      position: absolute;
      z-index: 2;
      border-radius: 4px;
    }
    .annotation-badge {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--paint-accent);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      transform: translate(-50%, -50%);
      z-index: 5;
    }
    .annotation-highlight {
      position: absolute;
      border-radius: 6px;
      pointer-events: none;
      z-index: 3;
    }
    .annotation-circle {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 3;
    }
    .annotation-box {
      position: absolute;
      border-radius: 6px;
      pointer-events: none;
      z-index: 3;
    }
    .annotation-arrow-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 6;
    }
    .annotation-text {
      position: absolute;
      color: #fff;
      background: rgba(0,0,0,0.82);
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 0.8rem;
      max-width: 42%;
      line-height: 1.4;
      white-space: pre-wrap;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.12);
      pointer-events: none;
      z-index: 5;
    }
    .annotation-callout-box {
      position: absolute;
      display: inline-block;
      pointer-events: none;
      z-index: 4;
    }
    .annotation-callout-inner {
      position: relative;
      z-index: 2;
      display: inline-block;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 0.82rem;
      font-weight: 500;
      line-height: 1.45;
      max-width: 280px;
      white-space: pre-wrap;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.5);
      background: #0a0a0a;
      color: #fafafa;
      border: 2px solid var(--color-primary);
    }

    ${mouseAnimationCss}

    /* ── Back to top ──────────────────────────────── */
    .back-to-top {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--paint-primary);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.25s, transform 0.25s;
      z-index: 100;
      font-size: 1.1rem;
      line-height: 1;
    }
    .back-to-top.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .back-to-top:hover {
      box-shadow: 0 6px 24px rgba(0,0,0,0.25);
    }

    /* ── Branding sections ────────────────────────── */
    .si-export-banner {
      margin-bottom: 32px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-fg) 8%, transparent);
      background: var(--color-bg-solid);
    }
    .si-export-banner img {
      width: 100%;
      max-height: 120px;
      object-fit: cover;
      object-position: center;
      display: block;
      image-rendering: -webkit-optimize-contrast;
    }
    ${embedMode === 'standalone' ? `
    .si-export-banner {
      margin-left: -24px;
      margin-right: -24px;
      width: calc(100% + 48px);
      border-radius: 0;
    }` : ''}
    .si-export-cover {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      margin-bottom: 40px;
      padding: 48px 32px;
      border-radius: 0;
      overflow: hidden;
      border: none;
    }
    .si-export-cover img {
      max-width: 280px;
      max-height: 120px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    ${embedMode === 'standalone' ? `
    .si-export-cover {
      margin-left: -24px;
      margin-right: -24px;
      width: calc(100% + 48px);
      margin-top: -24px;
      border-radius: 0 0 12px 12px;
    }` : ''}

    /* ── Print stylesheet ─────────────────────────── */
    @media print {
      html { scroll-behavior: auto; }
      body, .si-export-root {
        padding: 0;
        max-width: none;
        font-size: 11pt;
        line-height: 1.5;
      }
      .si-export-cover {
        page-break-after: always;
        break-after: page;
        max-height: none;
        border: none;
        margin: 0;
        width: 100%;
        padding: 80px 32px;
      }
      .si-export-cover img {
        max-width: 320px;
        max-height: 140px;
        object-fit: contain;
      }
      .step {
        page-break-inside: avoid;
        break-inside: avoid;
        box-shadow: none !important;
        border-color: #ddd;
      }
      .step-image-wrapper {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .back-to-top { display: none !important; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${bannerHtml}
  <div class="guide-header">
    <h1 class="guide-title">${escapeHtml(guide.title)}</h1>
    ${guide.description ? `<p class="guide-description">${descriptionToExportHtml(guide.description)}</p>` : ''}
  </div>

  ${stepsHtml}

  <button class="back-to-top" onclick="window.scrollTo({top:0})" aria-label="Back to top" title="Back to top">&#8593;</button>
  <script>
    (function(){
      var btn = document.querySelector('.back-to-top');
      if (!btn) return;
      var ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            btn.classList.toggle('visible', window.scrollY > 400);
            ticking = false;
          });
          ticking = true;
        }
      });
    })();
  </script>
</body>
</html>`;

  if (!includeDocumentShell) {
    const styleInner = html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    const bodyInner = bodyMatch?.[1]?.trim() ?? '';
    const fontLinkSnippet = noBranding
      ? ''
      : `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500&display=swap" rel="stylesheet" />`;
    return `${fontLinkSnippet}
${styleInner}
<div class="si-export-root">
${bodyInner}
</div>`;
  }

  return html;
}

function renderAnnotationsHtml(annotations: Guide['steps'][0]['annotations']): string {
  const pieces: string[] = [];
  const arrows: typeof annotations = [];

  for (const ann of annotations) {
    if (ann.type === 'arrow') {
      arrows.push(ann);
      continue;
    }
    if (ann.type === 'badge') {
      pieces.push(
        `<span class="annotation-badge" style="left:${ann.x}%;top:${ann.y}%">${escapeHtml(ann.text || '!')}</span>`
      );
      continue;
    }
    if (ann.type === 'callout') {
      const hasBox =
        ann.width != null && ann.height != null && ann.width > 0 && ann.height > 0;
      const { edge, offset } = parseCalloutTail(ann);
      const tails = exportCalloutTailMarkup(edge, offset);
      if (hasBox) {
        const cap = ann.width != null ? Math.min(ann.width, 92) : 92;
        pieces.push(
          `<div class="annotation-callout-box" style="left:${ann.x}%;top:${ann.y}%;max-width:${cap}%"><span class="annotation-callout-inner">${escapeHtml(ann.text || '')}</span>${tails}</div>`
        );
      } else {
        pieces.push(
          `<div class="annotation-callout-box" style="left:${ann.x}%;top:${ann.y}%"><span class="annotation-callout-inner">${escapeHtml(ann.text || '')}</span>${tails}</div>`
        );
      }
      continue;
    }
    if (ann.type === 'highlight' && ann.width != null && ann.height != null) {
      const stroke = resolveHighlightColor(ann.color);
      const fill = circleFillRgba(stroke, 0.24);
      pieces.push(
        `<div class="annotation-highlight" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width}%;height:${ann.height}%;border:2px solid ${stroke};background:${fill};box-shadow:0 0 16px ${stroke}59"></div>`
      );
      continue;
    }
    if (ann.type === 'circle' && ann.width != null && ann.height != null) {
      const stroke = resolveCircleStroke(ann.color);
      const fill = circleFillRgba(stroke, 0.14);
      pieces.push(
        `<div class="annotation-circle" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width}%;height:${ann.height}%;border:2px solid ${stroke};border-color:${stroke};background:${fill}"></div>`
      );
      continue;
    }
    if (ann.type === 'box' && ann.width != null && ann.height != null) {
      const stroke = resolveCircleStroke(ann.color);
      const opacity = ann.fillOpacity ?? 0.12;
      const fill = circleFillRgba(stroke, opacity);
      pieces.push(
        `<div class="annotation-box" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width}%;height:${ann.height}%;border:2px solid ${stroke};border-color:${stroke};background:${fill}"></div>`
      );
      continue;
    }
    if (ann.type === 'text') {
      pieces.push(
        `<div class="annotation-text" style="left:${ann.x}%;top:${ann.y}%">${escapeHtml(ann.text || '')}</div>`
      );
    }
  }

  if (arrows.length > 0) {
    const mk = arrows
      .map((ann) => {
        if (ann.x2 == null || ann.y2 == null) return '';
        const g = computeArrowParts(ann.x, ann.y, ann.x2, ann.y2);
        const pts = `${g.wing1.x},${g.wing1.y} ${g.tip.x},${g.tip.y} ${g.wing2.x},${g.wing2.y}`;
        return `<svg class="annotation-arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <g>
    <line x1="${ann.x}" y1="${ann.y}" x2="${g.shaftEnd.x}" y2="${g.shaftEnd.y}" stroke="var(--color-accent)" stroke-width="0.85" stroke-linecap="round" />
    <polygon points="${pts}" fill="var(--color-accent)" stroke="#b45309" stroke-width="0.1" stroke-linejoin="round" />
  </g>
</svg>`;
      })
      .join('\n');
    pieces.push(mk);
  }

  return pieces.join('\n');
}

function renderBlurRegionsHtml(regions: Guide['steps'][0]['blurRegions']): string {
  return regions
    .map((r) => {
      const s = clampBlurIntensity(r.intensity);
      const bpx = blurRadiusPx(s);
      const a = blurOverlayAlpha(s);
      return `<div class="blur-region" style="left:${r.x}%;top:${r.y}%;width:${r.width}%;height:${r.height}%;backdrop-filter:blur(${bpx}px);-webkit-backdrop-filter:blur(${bpx}px);background:rgba(15,23,42,${a.toFixed(3)})"></div>`;
    })
    .join('\n');
}

function renderMouseCursorHtml(position: { x: number; y: number }): string {
  return `<div class="mouse-cursor" style="left:${position.x}%;top:${position.y}%"></div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lightweight rich-text: escape, then **bold**, *italic*, `code`, and newlines. */
function descriptionToExportHtml(description: string): string {
  let html = escapeHtml(description);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code style="background:color-mix(in srgb, var(--color-fg) 8%, transparent);padding:1px 5px;border-radius:4px;font-size:0.88em">$1</code>');
  html = html.replace(/\n\n/g, '</p><p style="margin-top:8px">');
  html = html.replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}
