import type { Guide, BrandKit } from './types';
import { solidBrandHex } from '@/lib/brand/brand-color-value';

export interface DocxExportOptions {
  guide: Guide;
  brandKit?: BrandKit;
}

/**
 * Generates a Word-compatible HTML document.
 * For production, this will be replaced with the `docx` npm library for native .docx generation.
 * This intermediate approach produces HTML that Word can open natively.
 */
export function generateDocxExport(options: DocxExportOptions): string {
  const { guide, brandKit } = options;

  const raw = brandKit?.colors ?? {
    primary: '#2563EB',
    foreground: '#0F172A',
    background: '#FFFFFF',
  };
  const colors = {
    primary: solidBrandHex(raw.primary, '#2563EB'),
    foreground: solidBrandHex(raw.foreground, '#0F172A'),
    background: solidBrandHex(raw.background, '#FFFFFF'),
  };

  const fonts = brandKit?.fonts ?? { heading: 'Calibri', body: 'Calibri' };

  const stepsHtml = guide.steps
    .map(
      (step, i) => `
    <div style="margin-bottom: 32px; page-break-inside: avoid;">
      <h2 style="font-family: '${fonts.heading}'; color: ${colors.primary}; font-size: 18px; margin-bottom: 8px;">
        Step ${i + 1}: ${escapeHtml(step.title)}
      </h2>
      <p style="font-family: '${fonts.body}'; color: ${colors.foreground}; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        ${escapeHtml(step.description)}
      </p>
      ${
        step.screenshotUrl
          ? `<img src="${step.screenshotUrl}" alt="${escapeHtml(step.title)}" style="max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;" />`
          : ''
      }
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(guide.title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: '${fonts.body}', Calibri, sans-serif; color: ${colors.foreground}; padding: 48px; line-height: 1.6; }
    h1 { font-family: '${fonts.heading}', Calibri; font-size: 28px; color: ${colors.primary}; margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: #6b7280; margin-bottom: 48px; }
    .toc { margin-bottom: 48px; }
    .toc-item { font-size: 14px; color: ${colors.primary}; text-decoration: none; display: block; padding: 4px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(guide.title)}</h1>
  ${guide.description ? `<p class="subtitle">${escapeHtml(guide.description)}</p>` : ''}

  <div class="toc">
    <h2 style="font-size: 20px; color: ${colors.foreground}; margin-bottom: 12px;">Table of Contents</h2>
    ${guide.steps.map((step, i) => `<a class="toc-item" href="#step-${i + 1}">Step ${i + 1}: ${escapeHtml(step.title)}</a>`).join('\n')}
  </div>

  ${stepsHtml}

  <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
    Created with ShowcaseIt
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
