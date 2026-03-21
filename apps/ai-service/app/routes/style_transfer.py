from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from app.services.style_engine import StyleEngine
import io

router = APIRouter()
style_engine = StyleEngine()


@router.post("/apply")
async def apply_style(
    image: UploadFile = File(...),
    style: str = Form(default="clean"),
):
    """Apply a visual style to a screenshot."""
    image_bytes = await image.read()
    result = await style_engine.apply_style(image_bytes, style)
    return StreamingResponse(io.BytesIO(result), media_type="image/png")


@router.get("/styles")
async def list_styles():
    """List available visual styles."""
    return {
        "styles": [
            {"id": "clean", "name": "Clean", "description": "Minimal, crisp rendering"},
            {"id": "corporate", "name": "Corporate", "description": "Professional business style"},
            {"id": "modern", "name": "Modern", "description": "Contemporary flat design"},
            {"id": "minimal", "name": "Minimal", "description": "Ultra-clean with subtle shadows"},
        ]
    }
