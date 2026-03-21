import { imageSize } from 'image-size';

export type RasterImageKind = 'png' | 'jpg';

export type FetchedRasterImage = {
  data: Buffer;
  type: RasterImageKind;
  width: number;
  height: number;
};

const MAX_FETCH = 12 * 1024 * 1024;

/** Scale dimensions to fit max width (pixels), preserving aspect ratio. */
export function scaleToMaxWidth(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: Math.round((maxWidth * 9) / 16) };
  if (width <= maxWidth) return { width, height };
  const r = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * r)) };
}

/**
 * Download screenshot bytes and detect PNG/JPEG for docx/pdf embedding.
 * WebP and others are skipped (libraries need png/jpeg).
 */
export async function fetchRasterImage(url: string | null | undefined): Promise<FetchedRasterImage | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 80 || buf.length > MAX_FETCH) return null;

    const dim = imageSize(buf);
    if (!dim.width || !dim.height) return null;

    const mime = (res.headers.get('content-type') || '').toLowerCase();
    const lower = url.toLowerCase();

    if (dim.type === 'png' || mime.includes('png') || lower.includes('.png')) {
      return { data: buf, type: 'png', width: dim.width, height: dim.height };
    }
    if (
      dim.type === 'jpg' ||
      dim.type === 'jpeg' ||
      mime.includes('jpeg') ||
      mime.includes('jpg') ||
      lower.includes('.jpg') ||
      lower.includes('.jpeg')
    ) {
      return { data: buf, type: 'jpg', width: dim.width, height: dim.height };
    }

    return null;
  } catch {
    return null;
  }
}
