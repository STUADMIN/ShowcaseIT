import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from 'pdf-lib';
import { solidBrandHex } from '@/lib/brand/brand-color-value';
import { fetchRasterImage, scaleToMaxWidth } from './export-media';
import type { BrandKit } from './types';
import { headerBackgroundRgb, hexToPdfRgb, parseHexToRgb01 } from './export-brand-print';

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
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const HEADER_H = 42;
const FOOTER_H = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PDF_IMG_MAX_W = CONTENT_W;
const MIN_CONTENT_Y = MARGIN + FOOTER_H + 8;
/** Baseline Y for first content line (below header band). */
function contentTopY(): number {
  return PAGE_H - MARGIN - HEADER_H - 12;
}

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

function drawHeader(
  page: PDFPage,
  opts: {
    logo: PDFImage | null;
    brandName: string;
    font: PDFFont;
    fontBold: PDFFont;
    barRgb: RGB;
    titleRgb: RGB;
  }
) {
  const { logo, brandName, fontBold, barRgb, titleRgb } = opts;
  page.drawRectangle({
    x: 0,
    y: PAGE_H - HEADER_H,
    width: PAGE_W,
    height: HEADER_H,
    color: barRgb,
  });
  let x = MARGIN;
  const logoMaxH = 26;
  if (logo) {
    const scale = logoMaxH / logo.height;
    const lw = Math.min(logo.width * scale, 120);
    const lh = logo.height * (lw / logo.width);
    page.drawImage(logo, {
      x,
      y: PAGE_H - HEADER_H + (HEADER_H - lh) / 2,
      width: lw,
      height: lh,
    });
    x += lw + 10;
  }
  const label = brandName.trim() || 'Brand';
  page.drawText(label, {
    x,
    y: PAGE_H - 15,
    size: 11,
    font: fontBold,
    color: titleRgb,
  });
}

function drawFooterChrome(
  page: PDFPage,
  pageIndex: number,
  total: number,
  font: PDFFont,
  muted: RGB,
  accent: RGB,
  brandName: string
) {
  const lineY = MARGIN + FOOTER_H - 2;
  page.drawRectangle({
    x: MARGIN,
    y: lineY,
    width: PAGE_W - 2 * MARGIN,
    height: 0.75,
    color: accent,
  });
  const left = `ShowcaseIt · ${brandName.trim() || 'Guide'} · Page ${pageIndex} of ${total}`;
  page.drawText(left, {
    x: MARGIN,
    y: MARGIN + 6,
    size: 8,
    font,
    color: muted,
  });
}

export async function buildGuidePdfBuffer(input: GuidePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const brand = input.brand;
  const primaryHex = solidBrandHex(brand?.colors.primary, '#2563EB');
  const fgHex = solidBrandHex(brand?.colors.foreground, '#0F172A');
  const secondaryHex = solidBrandHex(brand?.colors.secondary, '#64748B');
  const bgHex = solidBrandHex(brand?.colors.background, '#FFFFFF');
  const primaryRgb = hexToPdfRgb(primaryHex, rgb(0.07, 0.36, 0.82));
  const fgRgb = hexToPdfRgb(fgHex, rgb(0.05, 0.09, 0.16));
  const bodyRgb = parseHexToRgb01(fgHex)
    ? hexToPdfRgb(fgHex, rgb(0.12, 0.16, 0.22))
    : rgb(0.12, 0.16, 0.22);
  const mutedRgb = hexToPdfRgb(secondaryHex, rgb(0.45, 0.48, 0.52));
  const headerBarRgb = brand ? headerBackgroundRgb(primaryHex) : rgb(0.93, 0.95, 0.98);
  const titleRgb = brand ? fgRgb : rgb(0.05, 0.09, 0.16);
  const stepTitleRgb = brand ? primaryRgb : rgb(0.07, 0.36, 0.82);

  let logoImage: PDFImage | null = null;
  if (brand?.logoUrl) {
    const fetched = await fetchRasterImage(brand.logoUrl);
    if (fetched) {
      try {
        logoImage =
          fetched.type === 'png' ? await pdf.embedPng(fetched.data) : await pdf.embedJpg(fetched.data);
      } catch {
        logoImage = null;
      }
    }
  }

  const brandName = brand?.name ?? '';

  let hasCoverSheet = false;
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
        const scale = Math.min(PAGE_W / coverEmbedded.width, PAGE_H / coverEmbedded.height);
        const w = coverEmbedded.width * scale;
        const h = coverEmbedded.height * scale;
        const x = (PAGE_W - w) / 2;
        const y = (PAGE_H - h) / 2;
        coverPage.drawImage(coverEmbedded, { x, y, width: w, height: h });
        hasCoverSheet = true;
      } catch {
        /* skip invalid cover */
      }
    }
  }

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(page, {
    logo: logoImage,
    brandName,
    font,
    fontBold,
    barRgb: headerBarRgb,
    titleRgb: fgRgb,
  });
  let y = contentTopY();

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    drawHeader(page, {
      logo: logoImage,
      brandName,
      font,
      fontBold,
      barRgb: headerBarRgb,
      titleRgb: fgRgb,
    });
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

  let stepNum = 0;
  for (const step of input.steps) {
    stepNum++;
    const heading = `Step ${stepNum}${step.title?.trim() ? `: ${step.title.trim()}` : ''}`;
    needSpace(22);
    page.drawText(heading, {
      x: MARGIN,
      y: y - 14,
      size: 14,
      font: fontBold,
      color: stepTitleRgb,
    });
    y -= 22;

    if (step.description?.trim()) {
      const bodyLines = step.description
        .trim()
        .split('\n')
        .flatMap((p) => wrapText(p, font, 11, CONTENT_W));
      drawLines(bodyLines, 11, font, 3, bodyRgb);
    }

    const img = await fetchRasterImage(step.screenshotUrl);
    if (img) {
      const { width, height } = scaleToMaxWidth(img.width, img.height, PDF_IMG_MAX_W);
      needSpace(height + 16);
      try {
        const embedded = img.type === 'png' ? await pdf.embedPng(img.data) : await pdf.embedJpg(img.data);
        page.drawImage(embedded, {
          x: MARGIN,
          y: y - height,
          width,
          height,
        });
        y -= height + 16;
      } catch {
        /* skip bad image */
      }
    }

    y -= 12;
  }

  const pages = pdf.getPages();
  const contentTotal = hasCoverSheet ? pages.length - 1 : pages.length;
  for (let i = 0; i < pages.length; i++) {
    if (hasCoverSheet && i === 0) continue;
    const contentPageNum = hasCoverSheet ? i : i + 1;
    drawFooterChrome(pages[i], contentPageNum, contentTotal, font, mutedRgb, primaryRgb, brandName);
  }

  return pdf.save();
}
