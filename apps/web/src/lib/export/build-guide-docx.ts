import {
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  convertInchesToTwip,
} from 'docx';
import { solidBrandHex } from '@/lib/brand/brand-color-value';
import type { SocialPlatformId } from '@/lib/brand/social-platform-assets';
import { fetchRasterImage, scaleToMaxWidth } from './export-media';
import type { BrandKit } from './types';
import { hexToDocxColor } from './export-brand-print';

export type GuideDocxStep = {
  order: number;
  title: string;
  description: string;
  screenshotUrl: string | null;
};

export type GuideDocxInput = {
  title: string;
  description: string | null;
  steps: GuideDocxStep[];
  brand?: BrandKit | null;
  /** When set with a matching Brand Kit asset, uses that platform’s logo in the header instead of the default logo. */
  exportSocialPlatform?: SocialPlatformId | null;
  /** When true, the export strips all branding: no logo, no cover, no banner, neutral header/footer. */
  noBranding?: boolean;
};

const DOC_IMG_MAX_W = 520;

export async function buildGuideDocxBuffer(input: GuideDocxInput): Promise<Buffer> {
  const noBranding = input.noBranding === true;
  const brand = noBranding ? null : input.brand;
  const primary = hexToDocxColor(noBranding ? '#6B7280' : solidBrandHex(brand?.colors.primary, '#2563EB'), '2563EB');
  const fg = hexToDocxColor(noBranding ? '#111827' : solidBrandHex(brand?.colors.foreground, '#0F172A'), '0F172A');
  const header = new Header({ children: [] });
  const footer = new Footer({ children: [] });

  const children: (Paragraph | Table)[] = [];

  if (!noBranding) {
    const coverRaster = await fetchRasterImage(brand?.guideCoverImageUrl ?? null);
    if (coverRaster) {
      const { width, height } = scaleToMaxWidth(coverRaster.width, coverRaster.height, 260);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [
            new ImageRun({
              type: coverRaster.type,
              data: coverRaster.data,
              transformation: { width, height },
            }),
          ],
        }),
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    const docBannerRaster = await fetchRasterImage(brand?.exportBannerDocumentUrl ?? null);
    if (docBannerRaster) {
      const { width, height } = scaleToMaxWidth(docBannerRaster.width, docBannerRaster.height, DOC_IMG_MAX_W);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new ImageRun({
              type: docBannerRaster.type,
              data: docBannerRaster.data,
              transformation: { width, height },
            }),
          ],
        })
      );
    }
  }

  const textColor = fg;
  const cardBorderColor = 'E2E8F0';
  const cardShade = 'F8FAFC';
  const mutedTextColor = '64748B';

  const cellBorder = (color: string, size = 6) => ({
    top: { color, space: 1, style: BorderStyle.SINGLE, size },
    bottom: { color, space: 1, style: BorderStyle.SINGLE, size },
    left: { color, space: 1, style: BorderStyle.SINGLE, size },
    right: { color, space: 1, style: BorderStyle.SINGLE, size },
  });
  const hiddenBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: input.title, bold: true, size: 56, color: textColor })],
    })
  );

  if (input.description?.trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: parseRichTextRuns(input.description.trim(), mutedTextColor, 22),
      })
    );
  }

  if (input.steps.length > 1) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: 'CONTENTS',
            bold: true,
            color: mutedTextColor,
            size: 18,
            font: 'Arial',
          }),
        ],
      })
    );
    input.steps.forEach((s, i) => {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true, color: primary, size: 20, font: 'Arial' }),
            new TextRun({ text: s.title?.trim() || `Step ${i + 1}`, color: textColor, size: 20, font: 'Arial' }),
          ],
        })
      );
    });
    children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));
  }

  let stepNum = 0;
  for (const step of input.steps) {
    stepNum++;
    const title = step.title?.trim() || '';

    const badgeCell = new TableCell({
      width: { size: 540, type: WidthType.DXA },
      borders: hiddenBorder,
      shading: { type: ShadingType.CLEAR, fill: primary, color: primary },
      verticalAlign: 'center' as never,
      margins: {
        top: convertInchesToTwip(0.06),
        bottom: convertInchesToTwip(0.06),
        left: convertInchesToTwip(0.05),
        right: convertInchesToTwip(0.05),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `${stepNum}`,
              bold: true,
              color: 'FFFFFF',
              size: 22,
              font: 'Arial',
            }),
          ],
        }),
      ],
    });

    const titleCell = new TableCell({
      borders: hiddenBorder,
      shading: { type: ShadingType.CLEAR, fill: cardShade, color: cardShade },
      verticalAlign: 'center' as never,
      margins: {
        top: convertInchesToTwip(0.06),
        bottom: convertInchesToTwip(0.06),
        left: convertInchesToTwip(0.12),
        right: convertInchesToTwip(0.12),
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: title || `Step ${stepNum}`,
              bold: true,
              color: textColor,
              size: 24,
              font: 'Arial',
            }),
          ],
        }),
      ],
    });

    const headerRow = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: hiddenBorder,
      rows: [
        new TableRow({
          children: [badgeCell, titleCell],
        }),
      ],
    });

    const contentParagraphs: (Paragraph | Table)[] = [];

    if (step.description?.trim()) {
      const lines = step.description.trim().split(/\n+/);
      for (const line of lines) {
        contentParagraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: parseRichTextRuns(line, mutedTextColor, 20),
          })
        );
      }
    }

    const img = await fetchRasterImage(step.screenshotUrl);
    if (img) {
      const maxImgW = DOC_IMG_MAX_W - 24;
      const { width, height } = scaleToMaxWidth(img.width, img.height, maxImgW);
      contentParagraphs.push(
        new Paragraph({
          spacing: { before: 100 },
          children: [
            new ImageRun({
              type: img.type,
              data: img.data,
              transformation: { width, height },
            }),
          ],
        })
      );
    }

    const cardContent = new TableCell({
      borders: hiddenBorder,
      shading: { type: ShadingType.CLEAR, fill: cardShade, color: cardShade },
      margins: {
        top: convertInchesToTwip(0.15),
        bottom: convertInchesToTwip(0.2),
        left: convertInchesToTwip(0.2),
        right: convertInchesToTwip(0.2),
      },
      children: [headerRow, ...contentParagraphs],
    });

    const card = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorder(cardBorderColor, 6),
      rows: [
        new TableRow({
          children: [cardContent],
        }),
      ],
    });

    children.push(card);

    children.push(
      new Paragraph({ spacing: { after: 280 }, children: [] })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function parseRichTextRuns(text: string, color: string, size: number): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      runs.push(new TextRun({ text: text.slice(last, match.index), color, size }));
    }
    if (match[1] != null) {
      runs.push(new TextRun({ text: match[1], bold: true, color, size }));
    } else if (match[2] != null) {
      runs.push(new TextRun({ text: match[2], italics: true, color, size }));
    } else if (match[3] != null) {
      runs.push(new TextRun({ text: match[3], color, size, font: 'Consolas' }));
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), color, size }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, color, size }));
  }
  return runs;
}
