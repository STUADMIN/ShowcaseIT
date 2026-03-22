/**
 * Fonts offered in Brand Kit — keep in sync with `fontOptions` in brand-kit-page.
 * Google Fonts CSS2 `family` param (spaces → +). Some legacy names map to current families.
 */
export const BRAND_KIT_FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Lato',
  'Playfair Display',
  'Merriweather',
  'Source Sans Pro',
  'Raleway',
] as const;

/** Google Fonts API slug when it differs from our stored label (saved kits keep the label). */
const GOOGLE_FONT_API_SLUG: Record<string, string> = {
  'Source Sans Pro': 'Source+Sans+3',
};

function googleFamilyQueryParam(displayName: string): string {
  const slug = GOOGLE_FONT_API_SLUG[displayName];
  if (slug) return slug;
  return encodeURIComponent(displayName.trim()).replace(/%20/g, '+');
}

/** URL for loading all brand-kit preview fonts (400–700). */
export function brandKitGoogleFontsStylesheetHref(): string {
  const families = BRAND_KIT_FONT_OPTIONS.map(
    (f) => `family=${googleFamilyQueryParam(f)}:wght@400;500;600;700`
  ).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

const SERIF_HINT = /playfair|merriweather/i;

/**
 * Valid CSS `font-family` stack: quote multi-word names; add generic fallback so preview matches intent.
 */
export function brandKitFontStackCss(fontName: string): string {
  const raw = fontName.trim();
  if (!raw) return 'system-ui, ui-sans-serif, sans-serif';
  const safe = raw.replace(/"/g, '');
  const quoted = /\s/.test(safe) ? `"${safe}"` : safe;
  if (SERIF_HINT.test(safe)) {
    return `${quoted}, Georgia, "Times New Roman", serif`;
  }
  return `${quoted}, system-ui, ui-sans-serif, sans-serif`;
}
