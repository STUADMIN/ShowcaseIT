from PIL import Image, ImageFilter, ImageEnhance
import io
import numpy as np


class StyleEngine:
    """Applies visual styles to screenshots to create business-animated representations."""

    async def apply_style(self, image_bytes: bytes, style: str = "clean") -> bytes:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

        style_methods = {
            "clean": self._apply_clean,
            "corporate": self._apply_corporate,
            "modern": self._apply_modern,
            "minimal": self._apply_minimal,
        }

        method = style_methods.get(style, self._apply_clean)
        result = method(image)

        output = io.BytesIO()
        result.save(output, format="PNG", quality=95)
        return output.getvalue()

    def _apply_clean(self, image: Image.Image) -> Image.Image:
        """Clean style: slight smoothing, enhanced contrast, crisp edges."""
        enhanced = ImageEnhance.Contrast(image).enhance(1.1)
        enhanced = ImageEnhance.Sharpness(enhanced).enhance(1.3)
        enhanced = ImageEnhance.Color(enhanced).enhance(0.95)
        return enhanced

    def _apply_corporate(self, image: Image.Image) -> Image.Image:
        """Corporate style: cooler tones, professional polish."""
        enhanced = ImageEnhance.Contrast(image).enhance(1.15)
        enhanced = ImageEnhance.Brightness(enhanced).enhance(1.05)
        enhanced = ImageEnhance.Color(enhanced).enhance(0.85)
        arr = np.array(enhanced)
        arr[:, :, 2] = np.clip(arr[:, :, 2].astype(np.int16) + 8, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    def _apply_modern(self, image: Image.Image) -> Image.Image:
        """Modern style: vibrant, flat-design feel."""
        enhanced = ImageEnhance.Color(image).enhance(1.2)
        enhanced = ImageEnhance.Contrast(enhanced).enhance(1.1)
        smoothed = enhanced.filter(ImageFilter.SMOOTH)
        return ImageEnhance.Sharpness(smoothed).enhance(1.5)

    def _apply_minimal(self, image: Image.Image) -> Image.Image:
        """Minimal style: desaturated, subtle, clean."""
        enhanced = ImageEnhance.Color(image).enhance(0.7)
        enhanced = ImageEnhance.Brightness(enhanced).enhance(1.08)
        enhanced = ImageEnhance.Contrast(enhanced).enhance(1.05)
        return enhanced
