import type { Guide, BrandKit } from './types';

export interface HtmlExportOptions {
  guide: Guide;
  brandKit?: BrandKit;
  embedMode: 'standalone' | 'iframe';
  includeAnimations: boolean;
}

export function generateHtmlExport(options: HtmlExportOptions): string {
  const { guide, brandKit, embedMode, includeAnimations } = options;

  const colors = brandKit?.colors ?? {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#FFFFFF',
    foreground: '#0F172A',
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
          <p class="step-desc">${escapeHtml(step.description)}</p>
        </div>
      </div>
      ${
        step.screenshotUrl
          ? `<div class="step-image-wrapper">
              <img src="${step.screenshotUrl}" alt="${escapeHtml(step.title)}" class="step-image" />
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(guide.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --color-bg: ${colors.background};
      --color-fg: ${colors.foreground};
      --font-heading: '${fonts.heading}', system-ui, sans-serif;
      --font-body: '${fonts.body}', system-ui, sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--font-body);
      background: var(--color-bg);
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
      background: color-mix(in srgb, var(--color-primary) 3%, var(--color-bg));
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
      background: var(--color-primary);
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
      backdrop-filter: blur(20px);
      background: rgba(128,128,128,0.15);
    }
    .annotation-badge {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-accent);
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
      color: var(--color-bg);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      max-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .annotation-highlight {
      position: absolute;
      border: 2px solid var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      border-radius: 4px;
    }
    ${mouseAnimationCss}
    .footer {
      text-align: center;
      padding: 32px 0;
      color: color-mix(in srgb, var(--color-fg) 30%, transparent);
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
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

  return html;
}

function renderAnnotationsHtml(annotations: Guide['steps'][0]['annotations']): string {
  return annotations
    .map((ann) => {
      if (ann.type === 'badge') {
        return `<span class="annotation-badge" style="left:${ann.x}%;top:${ann.y}%">${escapeHtml(ann.text || '!')}</span>`;
      }
      if (ann.type === 'callout') {
        return `<div class="annotation-callout" style="left:${ann.x}%;top:${ann.y}%">${escapeHtml(ann.text || '')}</div>`;
      }
      if (ann.type === 'highlight') {
        return `<div class="annotation-highlight" style="left:${ann.x}%;top:${ann.y}%;width:${ann.width || 10}%;height:${ann.height || 5}%"></div>`;
      }
      return '';
    })
    .join('\n');
}

function renderBlurRegionsHtml(regions: Guide['steps'][0]['blurRegions']): string {
  return regions
    .map(
      (r) =>
        `<div class="blur-region" style="left:${r.x}%;top:${r.y}%;width:${r.width}%;height:${r.height}%"></div>`
    )
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
