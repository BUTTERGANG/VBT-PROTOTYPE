"""Centralized configuration for the vision pipeline.

All tunable constants live here. Change one value, not ten files.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class VisionConfig:
    """Pipeline-wide configuration.

    Override via environment variables or a YAML/JSON config file.
    """

    # ── Plate reference ──
    plate_diameter_cm: float = 45.0  # Standard Olympic plate

    # ── Camera defaults ──
    camera_fps: float = 60.0
    camera_distance_m: float = 2.5
    frame_width: int = 3840
    frame_height: int = 2160

    # ── Detection ──
    detection_backend: str = "onnx"  # "onnx" or "yolo"
    onnx_model_path: str = "models/plate_detector.onnx"
    yolo_model_path: str = "models/plate_detector.pt"
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45
    inference_input_size: tuple[int, int] = (640, 640)

    # ── Velocity calculation ──
    velocity_smoothing_window: int = 3
    pause_velocity_threshold: float = 0.05  # m/s
    min_pause_duration_s: float = 0.1

    # ── Out-of-frame handling ──
    oof_strategy: str = "interpolate"  # "interpolate", "flag", "drop"
    oof_max_gap_frames: int = 5  # max frames to interpolate across
    oof_confidence_floor: float = 0.3  # below this, don't trust position

    # ── Caching ──
    cache_dir: str = ".vision_cache"
    use_cache: bool = True

    # ── Paths ──
    video_dir: str = "data/videos"
    labels_dir: str = "data/labels"
    models_dir: str = "models"

    @property
    def plate_diameter_m(self) -> float:
        return self.plate_diameter_cm / 100.0

    def model_path(self) -> str:
        """Return the active model path based on backend selection."""
        if self.detection_backend == "onnx":
            return self.onnx_model_path
        return self.yolo_model_path


# Global default config — import this everywhere
DEFAULT_CONFIG = VisionConfig()
