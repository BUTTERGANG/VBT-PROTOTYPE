"""Velocity calculation from displacement time series.

Handles mean velocity, peak velocity, and pause detection
for VBT-specific velocity metrics.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


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

    # Apply smoothing (NaN-aware: a NaN from dt==0 must not smear across
    # the whole window via convolution)
    if smoothing_window > 1:
        velocity = _smooth_nan_safe(velocity, smoothing_window)

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


def _smooth_nan_safe(velocity: np.ndarray, window: int) -> np.ndarray:
    """Moving-average smoothing that ignores NaN samples instead of
    propagating them to every neighbor within the window."""
    valid = np.isfinite(velocity)
    filled = np.where(valid, velocity, 0.0)
    kernel = np.ones(window) / window
    sums = np.convolve(filled, kernel, mode="same")
    counts = np.convolve(valid.astype(np.float64), kernel, mode="same")
    with np.errstate(invalid="ignore", divide="ignore"):
        smoothed = np.where(counts > 0, sums / counts, np.nan)
    # Original NaN positions stay NaN (no invented data), but their finite
    # neighbors are smoothed over the valid samples only.
    return smoothed


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
    max_gap_samples: int = 2,
) -> tuple[int, int]:
    """Find the start and end indices of the concentric (lifting) phase.

    The concentric phase is identified as the period of continuous
    upward movement (positive displacement derivative). Single-sample
    noise dips below the threshold do not split the phase: segments
    separated by at most ``max_gap_samples`` sub-threshold samples are
    merged.

    Args:
        displacement_m: (N,) displacement in meters
        timestamps_s: (N,) timestamps in seconds
        velocity_threshold: minimum velocity to count as "moving"
        max_gap_samples: max consecutive sub-threshold samples to bridge

    Returns:
        (start_idx, end_idx) of the concentric phase, inclusive.
        (-1, -1) if no sustained upward movement is found (callers must
        check — previously this fabricated a 2-sample phase).
    """
    if len(displacement_m) < 2:
        return (-1, -1)

    dt = np.diff(timestamps_s)
    dt = np.where(dt == 0, np.nan, dt)
    vel = np.diff(displacement_m) / dt

    is_positive = vel > velocity_threshold

    # Collect positive segments, merging those separated by small gaps
    segments: list[tuple[int, int]] = []  # [start_idx, end_idx] inclusive, over vel indices
    i = 0
    n = len(is_positive)
    while i < n:
        if is_positive[i]:
            start = i
            gap = 0
            end = i
            j = i + 1
            while j < n:
                if is_positive[j]:
                    end = j
                    gap = 0
                else:
                    gap += 1
                    if gap > max_gap_samples:
                        break
                j += 1
            segments.append((start, end))
            i = end + gap + 1 if gap else j
        else:
            i += 1

    if not segments:
        return (-1, -1)

    best_start, best_end = max(segments, key=lambda s: s[1] - s[0])

    # Convert velocity-segment indices to sample indices:
    # vel[k] is the displacement change between samples k and k+1.
    return (best_start, min(best_end + 1, len(displacement_m) - 1))
