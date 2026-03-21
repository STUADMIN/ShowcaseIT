from PIL import Image, ImageFilter
import io


class BlurService:
    """Applies blur to specified regions of an image for redaction."""

    async def blur_regions(
        self, image_bytes: bytes, regions: list[dict]
    ) -> bytes:
        """
        Blur specified rectangular regions in an image.

        Each region should have: x, y, width, height, intensity (optional, default 20)
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

        for region in regions:
            x = int(region["x"])
            y = int(region["y"])
            w = int(region["width"])
            h = int(region["height"])
            intensity = int(region.get("intensity", 20))

            box = (x, y, x + w, y + h)
            cropped = image.crop(box)
            blurred = cropped.filter(ImageFilter.GaussianBlur(radius=intensity))
            image.paste(blurred, box)

        output = io.BytesIO()
        image.save(output, format="PNG", quality=95)
        return output.getvalue()
