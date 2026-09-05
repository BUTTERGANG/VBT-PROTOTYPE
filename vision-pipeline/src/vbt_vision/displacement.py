"""Pixel-to-real-world displacement conversion.

Uses a known reference object (the weight plate) to compute
a perspective-aware pixel-to-real-world conversion factor.
Supports out-of-frame detection with configurable fallback strategies.
"""

from __future__ import annotations

import logging
from enum import Enum

import numpy as np

from .config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)


class OOFStrategy(Enum):
    """How to handle frames where the plate goes out of frame."""
    INTERPOLATE = "interpolate"
    FLAG = "flag"
    DROP = "drop"


def calibrate_from_plate(
    plate_diameter_px: float,
    known_diameter_m: float | None = None,
) -> float:
    """Compute pixels-per-meter from a detected plate.

    Perspective assumption (documented, not corrected): the plate is assumed
    to lie in the same depth plane as the bar path being measured and the
    camera is assumed near-perpendicular to that plane (side-view setup).
    Under those conditions a single px/m factor is valid. If the bar moves
    significantly toward/away from the camera, scale error grows with the
    depth change; keep camera_distance_m in the manifest and film from the
    side to bound this error.

    Args:
        plate_diameter_px: detected plate diameter in pixels
        known_diameter_m: real-world plate diameter in meters
            (defaults to config.plate_diameter_m)

    Returns:
        pixels_per_meter conversion factor
    """
    if known_diameter_m is None:
        known_diameter_m = DEFAULT_CONFIG.plate_diameter_m

    if plate_diameter_px <= 0:
        raise ValueError(f"plate_diameter_px must be positive, got {plate_diameter_px}")
    return plate_diameter_px / known_diameter_m


def pixel_to_meters(
    pixel_displacement: np.ndarray,
    pixels_per_meter: float,
) -> np.ndarray:
    """Convert pixel displacement to real-world meters.

    Sign convention: pixel coordinates are image coords, so +y points DOWN.
    A bar moving upward yields a negative dy; callers measuring lift velocity
    should negate the vertical component (see scripts/run_validation.py).

    Args:
        pixel_displacement: (N, 2) array of (dx, dy) in pixels,
            or (N,) array of scalar distances in pixels
        pixels_per_meter: conversion factor

    Returns:
        Displacement in meters, same shape as input
    """
    return pixel_displacement / pixels_per_meter


def compute_displacement(
    positions: np.ndarray,
    reference_idx: int = 0,
) -> np.ndarray:
    """Compute displacement of a point across frames relative to a reference frame.

    Args:
        positions: (N, 2) array of (x, y) pixel coordinates per frame
        reference_idx: index of the reference frame (default: first frame)

    Returns:
        (N, 2) array of (dx, dy) displacement from reference per frame
    """
    ref = positions[reference_idx]
    return positions - ref


def compute_total_distance(displacement: np.ndarray) -> np.ndarray:
    """Compute scalar total distance from 2D displacement vectors.

    Args:
        displacement: (N, 2) array of (dx, dy)

    Returns:
        (N,) array of scalar distances
    """
    return np.linalg.norm(displacement, axis=1)


def handle_out_of_frame(
    positions: np.ndarray,
    confidences: np.ndarray,
    frame_width: int,
    frame_height: int,
    strategy: OOFStrategy | str | None = None,
    max_gap_frames: int | None = None,
    confidence_floor: float | None = None,
) -> tuple[np.ndarray, np.ndarray, list[int]]:
    """Handle frames where the plate is partially or fully out of frame.

    Args:
        positions: (N, 2) array of (x, y) pixel positions per frame
        confidences: (N,) detection confidence per frame
        frame_width: frame width in pixels
        frame_height: frame height in pixels
        strategy: how to handle OOF frames (default: from config)
        max_gap_frames: max consecutive OOF frames to interpolate
        confidence_floor: below this confidence, treat as OOF

    Returns:
        (cleaned_positions, cleaned_confidences, oof_indices)
        OOF frames are interpolated/flagged per strategy.
        oof_indices lists all frames that were originally OOF.
    """
    if strategy is None:
        strategy = OOFStrategy(DEFAULT_CONFIG.oof_strategy)
    elif isinstance(strategy, str):
        strategy = OOFStrategy(strategy)

    if max_gap_frames is None:
        max_gap_frames = DEFAULT_CONFIG.oof_max_gap_frames
    if confidence_floor is None:
        confidence_floor = DEFAULT_CONFIG.oof_confidence_floor

    # Identify OOF frames: low confidence or position near edge
    oof_mask = confidences < confidence_floor

    # Also flag positions within 5% of frame edge as OOF
    edge_margin_x = frame_width * 0.05
    edge_margin_y = frame_height * 0.05
    near_edge = (
        (positions[:, 0] < edge_margin_x)
        | (positions[:, 0] > frame_width - edge_margin_x)
        | (positions[:, 1] < edge_margin_y)
        | (positions[:, 1] > frame_height - edge_margin_y)
    )
    oof_mask = oof_mask | near_edge

    oof_indices = list(np.where(oof_mask)[0])
    clean_positions = positions.copy()
    clean_confidences = confidences.copy()

    if not oof_indices:
        return clean_positions, clean_confidences, oof_indices

    if strategy == OOFStrategy.INTERPOLATE:
        clean_positions, clean_confidences = _interpolate_gaps(
            clean_positions, clean_confidences, oof_mask, max_gap_frames
        )
    elif strategy == OOFStrategy.FLAG:
        # Set confidence to 0 so downstream knows these are unreliable
        clean_confidences[oof_mask] = 0.0
    elif strategy == OOFStrategy.DROP:
        # Return only non-OOF frames
        good_mask = ~oof_mask
        clean_positions = clean_positions[good_mask]
        clean_confidences = clean_confidences[good_mask]

    logger.info(
        f"OOF handling ({strategy.value}): {len(oof_indices)} frames affected"
    )
    return clean_positions, clean_confidences, oof_indices


def _interpolate_gaps(
    positions: np.ndarray,
    confidences: np.ndarray,
    oof_mask: np.ndarray,
    max_gap: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Linearly interpolate across OOF gaps up to max_gap frames."""
    result = positions.copy()
    n = len(positions)

    i = 0
    while i < n:
        if oof_mask[i]:
            # Find end of gap
            gap_start = i
            while i < n and oof_mask[i]:
                i += 1
            gap_end = i  # first good frame after gap

            gap_length = gap_end - gap_start

            if (
                gap_length <= max_gap
                and gap_start > 0
                and gap_end < n
            ):
                # Interpolate between last good and next good
                before = positions[gap_start - 1]
                after = positions[gap_end]

                for j in range(gap_length):
                    t = (j + 1) / (gap_length + 1)
                    result[gap_start + j] = before + t * (after - before)
                    confidences[gap_start + j] = 0.3  # mark as interpolated
            else:
                # Gap too large or touches a boundary: we cannot produce a
                # trustworthy position here. Zero the confidence so downstream
                # consumers exclude these frames instead of treating the raw
                # (unreliable) detection as valid data.
                confidences[gap_start:gap_end] = 0.0
        else:
            i += 1

    return result, confidences
