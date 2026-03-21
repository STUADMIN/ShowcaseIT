from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from app.services.blur import BlurService
import io
import json

router = APIRouter()
blur_service = BlurService()


@router.post("/apply")
async def apply_blur(
    image: UploadFile = File(...),
    regions: str = Form(default="[]"),
):
    """Apply blur to specified regions of an image for redaction."""
    image_bytes = await image.read()
    regions_list = json.loads(regions)
    result = await blur_service.blur_regions(image_bytes, regions_list)
    return StreamingResponse(io.BytesIO(result), media_type="image/png")
