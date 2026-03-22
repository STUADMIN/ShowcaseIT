import type { Guide, BrandKit } from './types';
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
}

export function generateHtmlExport(options: HtmlExportOptions): string {
  const { guide, brandKit, embedMode, includeAnimations, includeDocumentShell = true } = options;

  const colors = brandKit?.colors ?? {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#FFFFFF',
    foreground: '#0F172A',
  };

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

  const fonts = brandKit?.fonts ?? { heading: 'Inter', body: 'Inter' };

  const stepsHtml = guide.steps
    .map(
      (step, i) => `
    <div class="step" id="step-${i + 1}">
      <div class="step-header">
        <span class="step-number">${i + 1}</span>
        <div>
          <h3 class="step-title">${escapeHtml(step.title)}</h3>
          <p class="step-desc">${descriptionToExportHtml(step.description)}</p>
        </div>
      </div>
      ${
        step.screenshotUrl
          ? `<div class="step-image-wrapper">
              <img src="${escapeHtml(step.screenshotUrl)}" alt="${escapeHtml(step.title)}" class="step-image" />
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

  const coverUrl = brandKit?.guideCoverImageUrl?.trim();
  const coverHtml =
    coverUrl && coverUrl.length > 0
      ? `<section class="si-export-cover" aria-label="Guide cover"><img src="${escapeHtml(coverUrl)}" alt="" /></section>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(guide.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500&display=swap" rel="stylesheet" />
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, .si-export-root {
      font-family: var(--font-body);
      background: var(--paint-bg);
      color: var(--color-fg);
      line-height: 1.6;
      ${embedMode === 'iframe' ? 'padding: 24px;' : 'padding: 48px 24px; max-width: 900px; margin: 0 auto;'}
    }
    .guide-header {
      margin-bottom: 48px;
      ${embedMode === 'standalone' ? 'text-align: center;' : ''}
    }
    .guide-title {
      font-family: var(--font-heading);
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--color-fg);
      margin-bottom: 8px;
    }
    .guide-description {
      font-size: 1.1rem;
      color: color-mix(in srgb, var(--color-fg) 60%, transparent);
    }
    .step {
      margin-bottom: 48px;
      padding: 32px;
      border-radius: 16px;
      border: 1px solid color-mix(in srgb, var(--color-fg) 10%, transparent);
      background: color-mix(in srgb, var(--color-primary) 3%, var(--color-bg-solid));
    }
    .step-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }
    .step-number {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--paint-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
    }
    .step-title {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .step-desc {
      color: color-mix(in srgb, var(--color-fg) 60%, transparent);
      font-size: 0.95rem;
    }
    .step-image-wrapper {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-fg) 8%, transparent);
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .step-image {
      width: 100%;
      display: block;
    }
    .blur-region {
      position: absolute;
    }
    .annotation-badge {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--paint-accent);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .annotation-callout {
      position: absolute;
      background: var(--color-fg);
      color: var(--color-bg-solid);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      max-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .annotation-highlight {
      position: absolute;
      border-radius: 6px;
      pointer-events: none;
    }
    .annotation-circle {
      position: absolute;
      border: 2px solid var(--color-secondary);
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
      pointer-events: none;
    }
    .annotation-box {
      position: absolute;
      border: 2px solid var(--color-primary);
      border-radius: 6px;
      background: transparent;
      pointer-events: none;
    }
    .annotation-arrow-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 4;
    }
    .annotation-text {
      position: absolute;
      color: var(--color-bg-solid);
      background: color-mix(in srgb, var(--color-fg) 85%, transparent);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      max-width: 42%;
      line-height: 1.35;
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      pointer-events: none;
    }
    .annotation-callout-box {
      position: absolute;
      display: inline-block;
      pointer-events: none;
      z-index: 3;
    }
    .annotation-callout-inner {
      position: relative;
      z-index: 2;
      display: inline-block;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 500;
      line-height: 1.4;
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      background: #0a0a0a;
      color: #fafafa;
      border: 2px solid var(--color-primary);
    }
    ${mouseAnimationCss}
    .footer {
      text-align: center;
      padding: 32px 0;
      color: color-mix(in srgb, var(--color-fg) 30%, transparent);
      font-size: 0.8rem;
    }
    .si-export-cover {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--paint-bg);
      margin-bottom: 40px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--color-fg) 8%, transparent);
    }
    .si-export-cover img {
      width: 100%;
      max-height: min(85vh, 520px);
      object-fit: contain;
      display: block;
    }
    ${embedMode === 'standalone' ? `
    .si-export-cover {
      margin-left: -24px;
      margin-right: -24px;
      width: calc(100% + 48px);
      margin-top: -24px;
      border-radius: 0 0 12px 12px;
    }` : ''}
    @media print {
      .si-export-cover {
        page-break-after: always;
        break-after: page;
        max-height: none;
        border: none;
        margin: 0;
        width: 100%;
      }
      .si-export-cover img {
        max-height: 100vh;
        object-fit: contain;
      }
    }
  </style>
</head>
<body>
  ${coverHtml}
  <div class="guide-header">
    <h1 class="guide-title">${escapeHtml(guide.title)}</h1>
    ${guide.description ? `<p class="guide-description">${escapeHtml(guide.description)}</p>` : ''}
  </div>

  ${stepsHtml}

  <div class="footer">
    Created with ShowcaseIt
  </div>
</body>
</html>`;

  if (!includeDocumentShell) {
    const styleInner = html.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    const bodyInner = bodyMatch?.[1]?.trim() ?? '';
    const fontLinkSnippet = `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500&display=swap" rel="stylesheet" />`;
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
        `<div class="annotation-circle" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width}%;height:${ann.height}%;border-color:${stroke};background:${fill}"></div>`
      );
      continue;
    }
    if (ann.type === 'box' && ann.width != null && ann.height != null) {
      const stroke = resolveCircleStroke(ann.color);
      const fill = circleFillRgba(stroke, 0.12);
      pieces.push(
        `<div class="annotation-box" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width}%;height:${ann.height}%;border-color:${stroke};background:${fill}"></div>`
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

/** Same lightweight rules as legacy html-template: escape first, then **bold** and newlines. */
function descriptionToExportHtml(description: string): string {
  let html = escapeHtml(description);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n\n/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  return html;
}
