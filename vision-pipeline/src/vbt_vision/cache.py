"""Detection result cache — avoid re-running inference on the same frames.

Cache key: video filename + frame number + model name.
This means reprocessing the same clip with different velocity parameters
won't re-run plate detection.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

from .detector import Detection, DetectionResult

logger = logging.getLogger(__name__)


def _make_key(video_path: str, frame_number: int, model_name: str) -> str:
    """Unique key per video + frame + model combination."""
    raw = f"{Path(video_path).name}:{frame_number}:{model_name}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class DetectionCache:
    """File-based cache for detection results.

    Cache structure (JSON):
    {
        "video_name": "squat_001.mp4",
        "model_name": "plate_detector_v1",
        "frames": {
            "0": {"detections": [...], "inference_time_ms": 12.3},
            "1": {"detections": [...], "inference_time_ms": 11.8},
            ...
        }
    }
    """

    def __init__(self, cache_dir: str | Path):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, video_path: str, model_name: str) -> Path:
        video_stem = Path(video_path).stem
        safe_model = model_name.replace("/", "_").replace(".", "_")
        return self.cache_dir / f"{video_stem}_{safe_model}.json"

    def get_frame(
        self,
        video_path: str,
        frame_number: int,
        model_name: str,
    ) -> DetectionResult | None:
        """Get cached result for a specific frame. Returns None on miss."""
        cache_path = self._cache_path(video_path, model_name)
        if not cache_path.exists():
            return None

        try:
            data = json.loads(cache_path.read_text())
            key = str(frame_number)
            if key not in data.get("frames", {}):
                return None

            frame_data = data["frames"][key]
            detections = [
                Detection(
                    bbox=tuple(d["bbox"]),
                    confidence=d["confidence"],
                    class_id=d.get("class_id", 0),
                )
                for d in frame_data.get("detections", [])
            ]

            return DetectionResult(
                frame_number=frame_number,
                detections=detections,
                inference_time_ms=frame_data.get("inference_time_ms", 0),
            )
        except (json.JSONDecodeError, KeyError):
            return None

    def put_frame(
        self,
        video_path: str,
        result: DetectionResult,
        model_name: str,
    ) -> None:
        """Cache a single frame's detection result."""
        cache_path = self._cache_path(video_path, model_name)

        # Load existing or create new
        if cache_path.exists():
            try:
                data = json.loads(cache_path.read_text())
            except json.JSONDecodeError:
                data = {"video_name": Path(video_path).name, "model_name": model_name, "frames": {}}
        else:
            data = {"video_name": Path(video_path).name, "model_name": model_name, "frames": {}}

        data["frames"][str(result.frame_number)] = {
            "detections": [
                {"bbox": list(d.bbox), "confidence": d.confidence, "class_id": d.class_id}
                for d in result.detections
            ],
            "inference_time_ms": result.inference_time_ms,
        }

        cache_path.write_text(json.dumps(data, indent=2))

    def get_all_frames(
        self,
        video_path: str,
        model_name: str,
    ) -> list[DetectionResult] | None:
        """Get all cached frames for a video. Returns None if cache miss."""
        cache_path = self._cache_path(video_path, model_name)
        if not cache_path.exists():
            return None

        try:
            data = json.loads(cache_path.read_text())
            results = []
            for key in sorted(data["frames"].keys(), key=int):
                frame_data = data["frames"][key]
                detections = [
                    Detection(
                        bbox=tuple(d["bbox"]),
                        confidence=d["confidence"],
                        class_id=d.get("class_id", 0),
                    )
                    for d in frame_data.get("detections", [])
                ]
                results.append(DetectionResult(
                    frame_number=int(key),
                    detections=detections,
                    inference_time_ms=frame_data.get("inference_time_ms", 0),
                ))
            return results if results else None
        except (json.JSONDecodeError, KeyError):
            return None

    def invalidate(self, video_path: str, model_name: str) -> None:
        """Remove cached results for a video+model pair."""
        cache_path = self._cache_path(video_path, model_name)
        cache_path.unlink(missing_ok=True)
