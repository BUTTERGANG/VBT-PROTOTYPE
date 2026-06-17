"""Validation metrics: compare vision-derived velocity against encoder ground truth.

Computes RMSE, MAE, bias, Pearson correlation, and per-exercise breakdowns.
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field


@dataclass
class ValidationMetrics:
    """Aggregated validation metrics for a set of reps/clips."""
    n_samples: int
    rmse: float  # root mean squared error (m/s)
    mae: float  # mean absolute error (m/s)
    bias: float  # mean(vision - encoder), positive = overestimate
    pearson_r: float  # correlation coefficient
    mean_vision: float
    mean_encoder: float
    std_vision: float
    std_encoder: float
    per_exercise: dict[str, "ValidationMetrics"] = field(default_factory=dict)

    def summary(self) -> str:
        lines = [
            f"n={self.n_samples}  RMSE={self.rmse:.4f}  MAE={self.mae:.4f}  "
            f"bias={self.bias:+.4f}  r={self.pearson_r:.3f}",
            f"  vision: {self.mean_vision:.3f} ± {self.std_vision:.3f} m/s",
            f"  encoder: {self.mean_encoder:.3f} ± {self.std_encoder:.3f} m/s",
        ]
        if self.per_exercise:
            lines.append("Per-exercise:")
            for ex, m in self.per_exercise.items():
                lines.append(
                    f"  {ex}: n={m.n_samples} RMSE={m.rmse:.4f} bias={m.bias:+.4f}"
                )
        return "\n".join(lines)


def compute_metrics(
    vision_velocity: np.ndarray,
    encoder_velocity: np.ndarray,
) -> ValidationMetrics:
    """Compute validation metrics comparing vision vs encoder velocity.

    Both arrays should contain paired scalar velocity values
    (e.g., mean velocity per rep).

    Args:
        vision_velocity: (N,) vision-derived velocities in m/s
        encoder_velocity: (N,) encoder ground truth velocities in m/s

    Returns:
        ValidationMetrics with all computed statistics
    """
    vision = np.asarray(vision_velocity, dtype=np.float64)
    encoder = np.asarray(encoder_velocity, dtype=np.float64)

    if len(vision) != len(encoder):
        raise ValueError(
            f"vision ({len(vision)}) and encoder ({len(encoder)}) must have same length"
        )
    if len(vision) == 0:
        raise ValueError("Empty arrays — need at least 1 sample")

    error = vision - encoder
    n = len(vision)

    rmse = float(np.sqrt(np.mean(error ** 2)))
    mae = float(np.mean(np.abs(error)))
    bias = float(np.mean(error))

    # Pearson correlation
    if n > 1 and np.std(vision) > 0 and np.std(encoder) > 0:
        pearson_r = float(np.corrcoef(vision, encoder)[0, 1])
    else:
        pearson_r = 0.0

    return ValidationMetrics(
        n_samples=n,
        rmse=rmse,
        mae=mae,
        bias=bias,
        pearson_r=pearson_r,
        mean_vision=float(np.mean(vision)),
        mean_encoder=float(np.mean(encoder)),
        std_vision=float(np.std(vision)),
        std_encoder=float(np.std(encoder)),
    )


def compute_metrics_per_exercise(
    vision_velocity: np.ndarray,
    encoder_velocity: np.ndarray,
    exercises: list[str],
) -> ValidationMetrics:
    """Compute overall + per-exercise validation metrics.

    Args:
        vision_velocity: (N,) vision-derived velocities
        encoder_velocity: (N,) encoder ground truth velocities
        exercises: (N,) exercise name for each sample

    Returns:
        ValidationMetrics with per_exercise breakdown populated
    """
    overall = compute_metrics(vision_velocity, encoder_velocity)

    unique_exercises = sorted(set(exercises))
    per_ex: dict[str, ValidationMetrics] = {}

    for ex in unique_exercises:
        mask = np.array([e == ex for e in exercises])
        if mask.sum() >= 1:
            per_ex[ex] = compute_metrics(
                vision_velocity[mask],
                encoder_velocity[mask],
            )

    overall.per_exercise = per_ex
    return overall
