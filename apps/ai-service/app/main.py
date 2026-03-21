from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import style_transfer, frame_extract, transcribe, health, blur

app = FastAPI(
    title="ShowcaseIt AI Service",
    version="0.1.0",
    description="AI microservice for style transfer, frame extraction, and transcription",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(style_transfer.router, prefix="/api/style", tags=["style-transfer"])
app.include_router(frame_extract.router, prefix="/api/frames", tags=["frame-extraction"])
app.include_router(transcribe.router, prefix="/api/transcribe", tags=["transcription"])
app.include_router(blur.router, prefix="/api/blur", tags=["blur"])
