"""Velocity calculation from displacement time series.

Handles mean velocity, peak velocity, and pause detection
for VBT-specific velocity metrics.
"""

from __future__ import annotations

import numpy as np
from dataclasses import dataclass, field


@dataclass
class VelocityResult:
    """Velocity analysis result for a single rep or movement phase."""
    mean_velocity: float  # m/s
    peak_velocity: float  # m/s
    time_series: np.ndarray  # (N,) velocity at each sample
    timestamps: np.ndarray  # (N,) timestamps in seconds
    pause_frames: list[int] = field(default_factory=list)  # indices where motion paused
    displacement_m: np.ndarray = field(default_factory=lambda: np.array([]))  # (N,) in meters


def compute_velocity(
    displacement_m: np.ndarray,
    timestamps_s: np.ndarray,
    smoothing_window: int = 3,
) -> VelocityResult:
    """Compute velocity from displacement and timestamps.

    Uses central differences for interior points, forward/backward
    differences at boundaries. Applies optional moving-average smoothing.

    Args:
        displacement_m: (N,) scalar displacement in meters
        timestamps_s: (N,) timestamps in seconds (must be same length, monotonically increasing)
        smoothing_window: size of moving average window (1 = no smoothing)

    Returns:
        VelocityResult with mean, peak, and time series
    """
    if len(displacement_m) != len(timestamps_s):
        raise ValueError(
            f"displacement ({len(displacement_m)}) and timestamps ({len(timestamps_s)}) "
            "must have same length"
        )
    if len(displacement_m) < 2:
        raise ValueError("Need at least 2 samples to compute velocity")

    # Compute dt
    dt = np.diff(timestamps_s)

    # Avoid division by zero
    dt = np.where(dt == 0, np.nan, dt)

    # Central differences for velocity
    velocity = np.full_like(displacement_m, np.nan, dtype=np.float64)

    # Forward difference for first point
    velocity[0] = (displacement_m[1] - displacement_m[0]) / dt[0]

    # Central differences for interior points
    for i in range(1, len(displacement_m) - 1):
        v_prev = (displacement_m[i] - displacement_m[i - 1]) / dt[i - 1]
        v_next = (displacement_m[i + 1] - displacement_m[i]) / dt[i]
        velocity[i] = (v_prev + v_next) / 2.0

    # Backward difference for last point
    velocity[-1] = (displacement_m[-1] - displacement_m[-2]) / dt[-1]

    # Apply smoothing
    if smoothing_window > 1:
        kernel = np.ones(smoothing_window) / smoothing_window
        # Use 'same' mode, but handle edges carefully
        velocity = np.convolve(velocity, kernel, mode="same")

    # Detect pauses
    pause_frames = detect_pauses(velocity, displacement_m, timestamps_s)

    # Compute metrics (excluding pause frames)
    active_mask = np.ones(len(velocity), dtype=bool)
    active_mask[pause_frames] = False
    active_velocity = velocity[active_mask]

    mean_vel = float(np.nanmean(active_velocity)) if len(active_velocity) > 0 else 0.0
    peak_vel = float(np.nanmax(np.abs(active_velocity))) if len(active_velocity) > 0 else 0.0

    return VelocityResult(
        mean_velocity=mean_vel,
        peak_velocity=peak_vel,
        time_series=velocity,
        timestamps=timestamps_s,
        pause_frames=pause_frames,
        displacement_m=displacement_m,
    )


def detect_pauses(
    velocity: np.ndarray,
    displacement_m: np.ndarray,
    timestamps_s: np.ndarray,
    velocity_threshold: float = 0.05,
    min_pause_duration_s: float = 0.1,
) -> list[int]:
    """Detect frames where the barbell is effectively stationary.

    A pause is defined as velocity below threshold for at least
    min_pause_duration_s.

    Args:
        velocity: (N,) velocity time series in m/s
        displacement_m: (N,) displacement in meters
        timestamps_s: (N,) timestamps in seconds
        velocity_threshold: below this = "stopped" (m/s)
        min_pause_duration_s: minimum duration to count as a pause

    Returns:
        List of frame indices that are part of a pause
    """
    is_slow = np.abs(velocity) < velocity_threshold

    pause_frames: list[int] = []
    in_pause = False
    pause_start = 0

    for i in range(len(is_slow)):
        if is_slow[i] and not in_pause:
            in_pause = True
            pause_start = i
        elif not is_slow[i] and in_pause:
            in_pause = False
            duration = timestamps_s[i - 1] - timestamps_s[pause_start]
            if duration >= min_pause_duration_s:
                pause_frames.extend(range(pause_start, i))

    # Handle pause that extends to end of clip
    if in_pause:
        duration = timestamps_s[-1] - timestamps_s[pause_start]
        if duration >= min_pause_duration_s:
            pause_frames.extend(range(pause_start, len(is_slow)))

    return pause_frames


def extract_concentric_phase(
    displacement_m: np.ndarray,
    timestamps_s: np.ndarray,
    velocity_threshold: float = 0.02,
) -> tuple[int, int]:
    """Find the start and end indices of the concentric (lifting) phase.

    The concentric phase is identified as the period of continuous
    upward movement (positive displacement derivative).

    Args:
        displacement_m: (N,) displacement in meters
        timestamps_s: (N,) timestamps in seconds
        velocity_threshold: minimum velocity to count as "moving"

    Returns:
        (start_idx, end_idx) of the concentric phase
    """
    if len(displacement_m) < 2:
        return (0, len(displacement_m) - 1)

    dt = np.diff(timestamps_s)
    dt = np.where(dt == 0, np.nan, dt)
    vel = np.diff(displacement_m) / dt

    # Find longest continuous positive-velocity segment
    is_positive = vel > velocity_threshold

    best_start = 0
    best_length = 0
    current_start = 0
    current_length = 0

    for i in range(len(is_positive)):
        if is_positive[i]:
            if current_length == 0:
                current_start = i
            current_length += 1
        else:
            if current_length > best_length:
                best_length = current_length
                best_start = current_start
            current_length = 0

    if current_length > best_length:
        best_length = current_length
        best_start = current_start

    return (best_start, min(best_start + best_length + 1, len(displacement_m) - 1))
