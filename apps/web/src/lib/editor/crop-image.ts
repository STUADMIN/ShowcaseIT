/**
 * Crop a loaded image using a rectangle expressed as % of the bitmap (0–100),
 * matching how guide annotations store positions over the screenshot.
 */
export async function cropImageToPngBlob(
  imageSrc: string,
  rectPct: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) {
        resolve(null);
        return;
      }
      const sx = Math.max(0, Math.floor((rectPct.x / 100) * nw));
      const sy = Math.max(0, Math.floor((rectPct.y / 100) * nh));
      const sw = Math.min(nw - sx, Math.ceil((rectPct.width / 100) * nw));
      const sh = Math.min(nh - sy, Math.ceil((rectPct.height / 100) * nh));
      if (sw < 2 || sh < 2) {
        resolve(null);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      try {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      } catch {
        resolve(null);
        return;
      }
      canvas.toBlob((b) => resolve(b), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}
