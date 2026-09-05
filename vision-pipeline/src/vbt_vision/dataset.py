"""Validation dataset loader — separate from production inference.

Loads labeled video clips and their ground truth for validation runs.
Designed to be completely independent from the production inference pipeline
to prevent data leakage.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class LabeledClip:
    """A video clip with ground truth labels for validation."""
    clip_id: str
    video_path: str
    exercise: str
    load_kg: float
    encoder_mean_velocity: float  # m/s ground truth
    encoder_peak_velocity: float
    camera_distance_m: float = 2.0
    camera_angle: str = "side"
    lighting: str = "good"
    # Optional: pre-labeled plate positions (frame_number, x1, y1, x2, y2)
    plate_labels: list[dict] = field(default_factory=list)


@dataclass
class ValidationDataset:
    """A collection of labeled clips for validation."""
    name: str
    clips: list[LabeledClip]

    @property
    def exercises(self) -> list[str]:
        return sorted({c.exercise for c in self.clips})

    def filter_by_exercise(self, exercise: str) -> list[LabeledClip]:
        return [c for c in self.clips if c.exercise == exercise]

    def summary(self) -> str:
        lines = [f"Dataset: {self.name} ({len(self.clips)} clips)"]
        for ex in self.exercises:
            clips = self.filter_by_exercise(ex)
            lines.append(f"  {ex}: {len(clips)} clips")
        return "\n".join(lines)


def load_dataset(manifest_path: str | Path) -> ValidationDataset:
    """Load a validation dataset from a JSON manifest.

    Manifest format:
    {
        "name": "v1-validation",
        "clips": [
            {
                "clip_id": "squat_001",
                "video_path": "data/videos/squat_001.mp4",
                "exercise": "Back Squat",
                "load_kg": 100,
                "encoder_mean_velocity": 0.45,
                "encoder_peak_velocity": 0.72,
                "camera_distance_m": 2.5,
                "camera_angle": "side",
                "lighting": "good",
                "plate_labels": [...]
            },
            ...
        ]
    }
    """
    path = Path(manifest_path)
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {path}")

    data = json.loads(path.read_text())

    clips = []
    for c in data.get("clips", []):
        clips.append(LabeledClip(
            clip_id=c["clip_id"],
            video_path=c["video_path"],
            exercise=c["exercise"],
            load_kg=c.get("load_kg", 0),
            encoder_mean_velocity=c.get("encoder_mean_velocity", 0),
            encoder_peak_velocity=c.get("encoder_peak_velocity", 0),
            camera_distance_m=c.get("camera_distance_m", 2.0),
            camera_angle=c.get("camera_angle", "side"),
            lighting=c.get("lighting", "good"),
            plate_labels=c.get("plate_labels", []),
        ))

    dataset = ValidationDataset(
        name=data.get("name", path.stem),
        clips=clips,
    )

    logger.info(dataset.summary())
    return dataset


def save_dataset(
    dataset: ValidationDataset,
    output_path: str | Path,
) -> None:
    """Save a validation dataset manifest to JSON."""
    data = {
        "name": dataset.name,
        "clips": [
            {
                "clip_id": c.clip_id,
                "video_path": c.video_path,
                "exercise": c.exercise,
                "load_kg": c.load_kg,
                "encoder_mean_velocity": c.encoder_mean_velocity,
                "encoder_peak_velocity": c.encoder_peak_velocity,
                "camera_distance_m": c.camera_distance_m,
                "camera_angle": c.camera_angle,
                "lighting": c.lighting,
                "plate_labels": c.plate_labels,
            }
            for c in dataset.clips
        ],
    }

    Path(output_path).write_text(json.dumps(data, indent=2))
    logger.info(f"Saved dataset manifest → {output_path}")
