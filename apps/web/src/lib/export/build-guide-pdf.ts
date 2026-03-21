import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { fetchRasterImage, scaleToMaxWidth } from './export-media';

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
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PDF_IMG_MAX_W = CONTENT_W;

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

export async function buildGuidePdfBuffer(input: GuidePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const needSpace = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  const drawLines = (lines: string[], size: number, f: PDFFont, lineGap = 2) => {
    for (const ln of lines) {
      const h = size + lineGap;
      needSpace(h);
      page.drawText(ln, {
        x: MARGIN,
        y: y - size,
        size,
        font: f,
        color: rgb(0.12, 0.16, 0.22),
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
    color: rgb(0.05, 0.09, 0.16),
  });
  y -= 32;

  if (input.description?.trim()) {
    const descLines = input.description.trim().split(/\n/).flatMap((p) => wrapText(p, font, 11, CONTENT_W));
    drawLines(descLines, 11, font, 3);
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
      color: rgb(0.07, 0.36, 0.82),
    });
    y -= 22;

    if (step.description?.trim()) {
      const bodyLines = step.description
        .trim()
        .split(/\n/)
        .flatMap((p) => wrapText(p, font, 11, CONTENT_W));
      drawLines(bodyLines, 11, font, 3);
    }

    const img = await fetchRasterImage(step.screenshotUrl);
    if (img) {
      const { width, height } = scaleToMaxWidth(img.width, img.height, PDF_IMG_MAX_W);
      needSpace(height + 16);
      try {
        const embedded =
          img.type === 'png' ? await pdf.embedPng(img.data) : await pdf.embedJpg(img.data);
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

  needSpace(14);
  const footer = 'Created with ShowcaseIt';
  page.drawText(footer, {
    x: MARGIN,
    y: y - 10,
    size: 9,
    font,
    color: rgb(0.55, 0.58, 0.62),
  });

  return pdf.save();
}
