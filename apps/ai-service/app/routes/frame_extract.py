from fastapi import APIRouter, UploadFile, File, Form
from app.services.frame_extractor import FrameExtractor

router = APIRouter()
frame_extractor = FrameExtractor()


@router.post("/extract")
async def extract_frames(
    video: UploadFile = File(...),
    click_timestamps: str = Form(default=""),
):
    """Extract key frames from a recording, optionally at specific click timestamps."""
    video_bytes = await video.read()
    timestamps = (
        [float(t.strip()) for t in click_timestamps.split(",") if t.strip()]
        if click_timestamps
        else None
    )
    frames = await frame_extractor.extract(video_bytes, timestamps)
    return {"frames": frames}
