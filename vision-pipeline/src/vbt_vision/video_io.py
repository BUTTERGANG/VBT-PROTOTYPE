"""Video I/O: frame extraction, resizing, batching for inference.

Uses OpenCV for video reading. Designed to be model-agnostic —
plug in any detection model that accepts numpy frames.
"""

from __future__ import annotations

import cv2
import numpy as np
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VideoMetadata:
    """Metadata about a video file."""
    path: str
    width: int
    height: int
    fps: float
    frame_count: int
    duration_s: float


def get_video_metadata(path: str | Path) -> VideoMetadata:
    """Read video metadata without loading frames into memory."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0.0
    cap.release()

    return VideoMetadata(
        path=str(path),
        width=w,
        height=h,
        fps=fps,
        frame_count=frame_count,
        duration_s=duration,
    )


def extract_frames(
    path: str | Path,
    sample_rate: int = 1,
    resize: tuple[int, int] | None = None,
) -> tuple[list[np.ndarray], list[float]]:
    """Extract frames from a video file.

    Args:
        path: video file path
        sample_rate: extract every Nth frame (1 = every frame)
        resize: optional (width, height) to resize frames

    Returns:
        (frames, timestamps) — list of BGR frames as numpy arrays,
        list of timestamps in seconds
    """
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")

    frames: list[np.ndarray] = []
    timestamps: list[float] = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_rate == 0:
            if resize is not None:
                frame = cv2.resize(frame, resize, interpolation=cv2.INTER_LINEAR)
            frames.append(frame)
            timestamps.append(frame_idx / cap.get(cv2.CAP_PROP_FPS))

        frame_idx += 1

    cap.release()
    return frames, timestamps


def frame_batches(
    frames: list[np.ndarray],
    batch_size: int = 16,
) -> list[list[np.ndarray]]:
    """Split frames into batches for batched inference.

    Args:
        frames: list of frames
        batch_size: frames per batch

    Returns:
        List of frame batches (each batch is a list of frames)
    """
    return [
        frames[i : i + batch_size]
        for i in range(0, len(frames), batch_size)
    ]


def extract_region_of_interest(
    frame: np.ndarray,
    bbox: tuple[int, int, int, int],
    padding: float = 0.1,
) -> np.ndarray:
    """Extract a region of interest from a frame with optional padding.

    Args:
        frame: BGR frame (H, W, 3)
        bbox: (x1, y1, x2, y2) in pixels
        padding: fraction of bbox size to add as padding

    Returns:
        Cropped ROI as numpy array
    """
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = bbox

    bw = x2 - x1
    bh = y2 - y1

    pad_x = int(bw * padding)
    pad_y = int(bh * padding)

    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)

    return frame[y1:y2, x1:x2]
