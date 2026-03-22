/**
 * Placeholder step description when guide generation extracts zero frames.
 * Keep in sync with `api/guides/generate` — import this constant there.
 */
export const FRAME_EXTRACTION_PLACEHOLDER_DESCRIPTION =
  'No frames could be extracted from this video. Delete this guide, then go to Recordings → Generate Guide again. If it keeps failing, open /api/health/ffmpeg and confirm ok is true.';

/** First sentence — used to detect “generation failed” copy even if the full string drifts. */
export const FRAME_EXTRACTION_ERROR_HINT = 'No frames could be extracted from this video';

function normalizePlaceholderText(s: string): string {
  return s
    .replace(/→/g, '->')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when description is exactly the server-generated placeholder (arrow / spacing variants allowed). */
export function isFrameExtractionPlaceholder(description: string): boolean {
  return (
    normalizePlaceholderText(description) === normalizePlaceholderText(FRAME_EXTRACTION_PLACEHOLDER_DESCRIPTION)
  );
}
