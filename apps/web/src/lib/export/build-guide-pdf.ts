import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from 'pdf-lib';
import { solidBrandHex } from '@/lib/brand/brand-color-value';
import type { SocialPlatformId } from '@/lib/brand/social-platform-assets';
import { fetchRasterImage, scaleToMaxWidth } from './export-media';
import type { BrandKit } from './types';
import { hexToPdfRgb, parseHexToRgb01 } from './export-brand-print';

export type GuidePdfStep = {
  order: number;
  title: string;
  description: string;
  screenshotUrl: string | null;
};

export type GuidePdfInput = {
  title: string;
  description: string | null;
  steps: GuidePdfStep[];
  /** When set, PDF gets branded header (logo + name strip), primary-colored step titles, and footers with page numbers. */
  brand?: BrandKit | null;
  /** When set with a matching Brand Kit asset, uses that platform’s logo in the header instead of the default logo. */
  exportSocialPlatform?: SocialPlatformId | null;
  /** When true, the export strips all branding: no logo, no cover, no banner, plain header/footer. */
  noBranding?: boolean;
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const MIN_CONTENT_Y = MARGIN + 20;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) {
        lines.push(line);
        line = '';
      }
      if (font.widthOfTextAtSize(w, size) <= maxWidth) {
        line = w;
      } else {
        lines.push(w);
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncateToFit(text: string, f: PDFFont, size: number, maxW: number): string {
  if (f.widthOfTextAtSize(text, size) <= maxW) return text;
  let truncated = text;
  while (truncated.length > 0 && f.widthOfTextAtSize(truncated + '…', size) > maxW) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

export async function buildGuidePdfBuffer(input: GuidePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const noBranding = input.noBranding === true;
  const brand = noBranding ? null : input.brand;
  const primaryHex = noBranding ? '#6B7280' : solidBrandHex(brand?.colors.primary, '#2563EB');
  const fgHex = noBranding ? '#111827' : solidBrandHex(brand?.colors.foreground, '#0F172A');
  const bgHex = solidBrandHex(brand?.colors.background, '#FFFFFF');
  const primaryRgb = hexToPdfRgb(primaryHex, rgb(0.07, 0.36, 0.82));
  const fgRgb = hexToPdfRgb(fgHex, rgb(0.05, 0.09, 0.16));
  const bodyRgb = parseHexToRgb01(fgHex)
    ? hexToPdfRgb(fgHex, rgb(0.12, 0.16, 0.22))
    : rgb(0.12, 0.16, 0.22);
  const titleRgb = brand ? fgRgb : rgb(0.05, 0.09, 0.16);

  const contentTopY = () => PAGE_H - MARGIN - 12;

  if (!noBranding) {
    const coverUrl = brand?.guideCoverImageUrl;
    if (coverUrl) {
      const coverRaster = await fetchRasterImage(coverUrl);
      if (coverRaster) {
        try {
          const coverEmbedded =
            coverRaster.type === 'png'
              ? await pdf.embedPng(coverRaster.data)
              : await pdf.embedJpg(coverRaster.data);
          const coverPage = pdf.addPage([PAGE_W, PAGE_H]);
          const coverBg = hexToPdfRgb(bgHex, rgb(1, 1, 1));
          coverPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: coverBg });
          const maxLogoW = 240;
          const maxLogoH = 120;
          const scale = Math.min(maxLogoW / coverEmbedded.width, maxLogoH / coverEmbedded.height, 1);
          const w = coverEmbedded.width * scale;
          const h = coverEmbedded.height * scale;
          const x = (PAGE_W - w) / 2;
          const y = (PAGE_H - h) / 2 + 60;
          coverPage.drawImage(coverEmbedded, { x, y, width: w, height: h });
        } catch {
          /* skip invalid cover */
        }
      }
    }
  }

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = contentTopY();

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = contentTopY();
  };

  const needSpace = (h: number) => {
    if (y - h < MIN_CONTENT_Y) newPage();
  };

  const drawLines = (lines: string[], size: number, f: PDFFont, lineGap = 2, color: RGB = bodyRgb) => {
    for (const ln of lines) {
      const h = size + lineGap;
      needSpace(h);
      page.drawText(ln, {
        x: MARGIN,
        y: y - size,
        size,
        font: f,
        color,
      });
      y -= h;
    }
  };

  needSpace(28);
  page.drawText(input.title, {
    x: MARGIN,
    y: y - 20,
    size: 20,
    font: fontBold,
    color: titleRgb,
  });
  y -= 32;

  if (input.description?.trim()) {
    const descLines = input.description.trim().split('\n').flatMap((p) => wrapText(p, font, 11, CONTENT_W));
    drawLines(descLines, 11, font, 3, bodyRgb);
    y -= 8;
  }

  if (input.steps.length > 1) {
    y -= 16;
    needSpace(22);
    page.drawText('CONTENTS', {
      x: MARGIN,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: rgb(0.45, 0.5, 0.56),
    });
    y -= 22;

    const tocLineH = 18;
    for (let i = 0; i < input.steps.length; i++) {
      const tocTitle = input.steps[i].title?.trim() || `Step ${i + 1}`;
      needSpace(tocLineH);
      const numStr = `${i + 1}.`;
      page.drawText(numStr, { x: MARGIN + 4, y: y - 10, size: 10, font: fontBold, color: primaryRgb });
      const numW = fontBold.widthOfTextAtSize(numStr, 10);
      const maxTocW = CONTENT_W - numW - 16;
      const truncTitle = truncateToFit(tocTitle, font, 10, maxTocW);
      page.drawText(truncTitle, { x: MARGIN + 4 + numW + 8, y: y - 10, size: 10, font, color: bodyRgb });
      y -= tocLineH;
    }
    y -= 10;
  }

  const cardPad = 16;
  const cardInner = CONTENT_W - cardPad * 2;
  const cardBg = rgb(0.973, 0.98, 0.988);
  const cardBorderRgb = rgb(0.886, 0.91, 0.94);
  const badgeRadius = 14;
  const badgeGap = 10;
  const descMutedRgb = rgb(0.39, 0.45, 0.53);

  let stepNum = 0;
  for (const step of input.steps) {
    stepNum++;
    const title = step.title?.trim() || `Step ${stepNum}`;

    let imgEmbedded: PDFImage | null = null;
    let imgW = 0;
    let imgH = 0;
    const imgRaster = await fetchRasterImage(step.screenshotUrl);
    if (imgRaster) {
      try {
        imgEmbedded =
          imgRaster.type === 'png' ? await pdf.embedPng(imgRaster.data) : await pdf.embedJpg(imgRaster.data);
        const scaled = scaleToMaxWidth(imgRaster.width, imgRaster.height, cardInner);
        imgW = scaled.width;
        imgH = scaled.height;
      } catch {
        imgEmbedded = null;
      }
    }

    const descLines = step.description?.trim()
      ? step.description.trim().split('\n').flatMap((p) => wrapText(p, font, 10, cardInner - badgeRadius * 2 - badgeGap))
      : [];
    const descBlockH = descLines.length * 13;

    const headerH = badgeRadius * 2 + 4;
    const cardContentH = headerH + (descBlockH > 0 ? descBlockH + 6 : 0) + (imgEmbedded ? imgH + 12 : 0);
    const totalCardH = cardContentH + cardPad * 2;

    needSpace(totalCardH + 20);

    const cardTop = y;
    const cardBottom = y - totalCardH;

    page.drawRectangle({
      x: MARGIN,
      y: cardBottom,
      width: CONTENT_W,
      height: totalCardH,
      color: cardBg,
      borderColor: cardBorderRgb,
      borderWidth: 1,
    });

    const badgeCx = MARGIN + cardPad + badgeRadius;
    const badgeCy = cardTop - cardPad - badgeRadius;
    page.drawCircle({
      x: badgeCx,
      y: badgeCy,
      size: badgeRadius,
      color: primaryRgb,
    });
    const numStr = `${stepNum}`;
    const numW = fontBold.widthOfTextAtSize(numStr, 11);
    page.drawText(numStr, {
      x: badgeCx - numW / 2,
      y: badgeCy - 4,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const titleX = MARGIN + cardPad + badgeRadius * 2 + badgeGap;
    const titleMaxW = cardInner - badgeRadius * 2 - badgeGap;
    const titleLines = wrapText(title, fontBold, 13, titleMaxW);
    let ty = cardTop - cardPad - 5;
    for (const ln of titleLines) {
      page.drawText(ln, {
        x: titleX,
        y: ty - 10,
        size: 13,
        font: fontBold,
        color: fgRgb,
      });
      ty -= 16;
    }

    let cy = cardTop - cardPad - headerH;

    if (descLines.length > 0) {
      cy -= 2;
      for (const ln of descLines) {
        const stripped = ln.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
        const isBold = /\*\*/.test(ln);
        page.drawText(stripped, {
          x: titleX,
          y: cy - 10,
          size: 10,
          font: isBold ? fontBold : font,
          color: descMutedRgb,
        });
        cy -= 13;
      }
      cy -= 4;
    }

    if (imgEmbedded) {
      const imgX = MARGIN + cardPad;
      const imgY = cy - imgH;

      page.drawRectangle({
        x: imgX - 1,
        y: imgY - 1,
        width: imgW + 2,
        height: imgH + 2,
        borderColor: cardBorderRgb,
        borderWidth: 0.5,
      });
      page.drawImage(imgEmbedded, {
        x: imgX,
        y: imgY,
        width: imgW,
        height: imgH,
      });
    }

    y = cardBottom - 18;
  }

  

  return pdf.save();
}
