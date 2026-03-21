import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
} from 'docx';
import { fetchRasterImage, scaleToMaxWidth } from './export-media';

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
};

const DOC_IMG_MAX_W = 520;

export async function buildGuideDocxBuffer(input: GuideDocxInput): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: input.title, bold: true })],
    })
  );

  if (input.description?.trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun({ text: input.description.trim(), italics: true, color: '666666' })],
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
        children: [new TextRun({ text: label, bold: true })],
      })
    );

    if (step.description?.trim()) {
      const lines = step.description.trim().split(/\n+/);
      for (const line of lines) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun(line)],
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

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Created with ShowcaseIt', size: 18, color: '999999' })],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
