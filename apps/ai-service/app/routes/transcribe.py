from fastapi import APIRouter, UploadFile, File

router = APIRouter()


@router.post("/audio")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe voiceover audio to text segments."""
    # Placeholder: will integrate Whisper when available
    return {
        "segments": [],
        "message": "Transcription service will be available when Whisper model is configured",
    }
