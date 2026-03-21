import io
import base64
import tempfile
import os
from typing import Optional
import cv2
import numpy as np


class FrameExtractor:
    """Extracts key frames from video recordings."""

    async def extract(
        self, video_bytes: bytes, click_timestamps: Optional[list[float]] = None
    ) -> list[dict]:
        """Extract frames at click timestamps, or detect key frames automatically."""
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            cap = cv2.VideoCapture(tmp_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            if click_timestamps:
                frames = self._extract_at_timestamps(cap, fps, click_timestamps)
            else:
                frames = self._extract_key_frames(cap, fps, total_frames)

            cap.release()
            return frames
        finally:
            os.unlink(tmp_path)

    def _extract_at_timestamps(
        self, cap: cv2.VideoCapture, fps: float, timestamps: list[float]
    ) -> list[dict]:
        frames = []
        for ts in sorted(timestamps):
            frame_num = int(ts * fps / 1000)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if ret:
                frames.append(
                    {
                        "timestamp": ts,
                        "image": self._frame_to_base64(frame),
                        "width": frame.shape[1],
                        "height": frame.shape[0],
                    }
                )
        return frames

    def _extract_key_frames(
        self, cap: cv2.VideoCapture, fps: float, total_frames: int
    ) -> list[dict]:
        """Detect scene changes by comparing frame differences."""
        frames = []
        prev_gray = None
        threshold = 30.0

        for i in range(0, total_frames, max(1, int(fps / 2))):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                mean_diff = np.mean(diff)
                if mean_diff > threshold:
                    frames.append(
                        {
                            "timestamp": (i / fps) * 1000,
                            "image": self._frame_to_base64(frame),
                            "width": frame.shape[1],
                            "height": frame.shape[0],
                        }
                    )
            else:
                frames.append(
                    {
                        "timestamp": 0,
                        "image": self._frame_to_base64(frame),
                        "width": frame.shape[1],
                        "height": frame.shape[0],
                    }
                )
            prev_gray = gray

        return frames

    @staticmethod
    def _frame_to_base64(frame: np.ndarray) -> str:
        _, buffer = cv2.imencode(".png", frame)
        return base64.b64encode(buffer).decode("utf-8")
