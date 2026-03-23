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
  PageNumber,
  PageBreak,
  convertInchesToTwip,
} from 'docx';
import { solidBrandHex } from '@/lib/brand/brand-color-value';
import { resolveExportLogoUrl } from '@/lib/brand/social-platform-assets';
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
};

const DOC_IMG_MAX_W = 520;

export async function buildGuideDocxBuffer(input: GuideDocxInput): Promise<Buffer> {
  const brand = input.brand;
  const primary = hexToDocxColor(solidBrandHex(brand?.colors.primary, '#2563EB'), '2563EB');
  const fg = hexToDocxColor(solidBrandHex(brand?.colors.foreground, '#0F172A'), '0F172A');
  const descMuted = hexToDocxColor(solidBrandHex(brand?.colors.secondary, '#666666'), '666666');
  const footerMuted = '94A3B8';

  const headerLabel = (brand?.name ?? '').trim() || 'ShowcaseIt';

  const headerChildren: (TextRun | ImageRun)[] = [];
  const logoUrlForExport = resolveExportLogoUrl(
    brand?.logoUrl,
    brand?.socialPlatformAssets,
    input.exportSocialPlatform ?? null
  );
  const logo = await fetchRasterImage(logoUrlForExport ?? null);
  if (logo) {
    const { width, height } = scaleToMaxWidth(logo.width, logo.height, 100);
    headerChildren.push(
      new ImageRun({
        type: logo.type,
        data: logo.data,
        transformation: { width, height },
      }),
      new TextRun({ text: '   ' })
    );
  }
  headerChildren.push(
    new TextRun({
      text: headerLabel,
      bold: true,
      size: 22,
      color: fg,
    })
  );

  const header = new Header({
    children: [
      new Paragraph({
        border: {
          bottom: {
            color: primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        spacing: { after: 160 },
        children: headerChildren,
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({
            text: `Created with ShowcaseIt  ·  ${headerLabel}  ·  Page `,
            size: 18,
            color: footerMuted,
          }),
          new TextRun({
            children: [PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
            size: 18,
            color: footerMuted,
          }),
        ],
      }),
    ],
  });

  const children: Paragraph[] = [];

  const coverRaster = await fetchRasterImage(brand?.guideCoverImageUrl ?? null);
  if (coverRaster) {
    const { width, height } = scaleToMaxWidth(coverRaster.width, coverRaster.height, 620);
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

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: input.title, bold: true, size: 56, color: fg })],
    })
  );

  if (input.description?.trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: input.description.trim(),
            italics: true,
            color: descMuted,
          }),
        ],
      })
    );
  }

  let stepNum = 0;
  for (const step of input.steps) {
    stepNum++;
    const label = `Step ${stepNum}${step.title?.trim() ? `: ${step.title.trim()}` : ''}`;

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 },
        children: [new TextRun({ text: label, bold: true, color: primary })],
      })
    );

    if (step.description?.trim()) {
      const lines = step.description.trim().split(/\n+/);
      for (const line of lines) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: line, color: fg })],
          })
        );
      }
    }

    const img = await fetchRasterImage(step.screenshotUrl);
    if (img) {
      const { width, height } = scaleToMaxWidth(img.width, img.height, DOC_IMG_MAX_W);
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 240 },
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
