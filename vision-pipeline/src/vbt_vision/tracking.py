"""Bar-path tracking over a clip — shared by the offline scripts.

Detection strategy:
1. If an ONNX plate-detector model path is supplied (and onnxruntime is
   installed), use PlateDetectorONNX.
2. Otherwise fall back to a classical Hough-circle plate finder. This is a
   documented heuristic suitable for well-lit side-view clips with a visible
   plate rim; it exists so the validation harness runs with zero model
   assets. It is NOT the production detector.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from .displacement import calibrate_from_plate, handle_out_of_frame
from .velocity import compute_velocity, extract_concentric_phase
from .video_io import extract_frames

logger = logging.getLogger(__name__)


@dataclass
class TrackResult:
    """Per-clip tracking output in pixel and real-world units."""
    positions_px: np.ndarray  # (N, 2) raw detected centers
    confidences: np.ndarray  # (N,)
    timestamps_s: np.ndarray  # (N,) actual frame timestamps (frame_idx / fps)
    plate_diameter_px: float  # median detected plate diameter
    oof_indices: list[int] = field(default_factory=list)
    # Derived (filled by track_clip when calibration is possible)
    velocity: object | None = None  # VelocityResult
    mean_velocity: float | None = None  # m/s over concentric phase
    peak_velocity: float | None = None  # m/s over concentric phase
    concentric_range: tuple[int, int] | None = None


def detect_plate_hough(
    frame: np.ndarray,
    min_radius_px: int = 20,
    max_radius_px: int = 0,
) -> tuple[tuple[int, int] | None, float, float]:
    """Heuristic plate detector: Hough circles on a blurred grayscale frame.

    Returns (center (x, y), diameter_px, confidence 0-1) for the strongest
    circle, or (None, 0.0, 0.0) if nothing plausible is found.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.GaussianBlur(gray, (9, 9), 2)

    h, w = gray.shape
    if max_radius_px <= 0:
        max_radius_px = min(h, w) // 2

    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.5,
        minDist=w // 4,
        param1=120,
        param2=40,
        minRadius=min_radius_px,
        maxRadius=max_radius_px,
    )
    if circles is None:
        return None, 0.0, 0.0

    # Strongest = largest radius (plates dominate the frame in side view)
    c = circles[0][np.argmax(circles[0][:, 2])]
    x, y, r = float(c[0]), float(c[1]), float(c[2])
    confidence = min(0.9, 0.4 + r / max_radius_px * 0.5)
    return (round(x), round(y)), 2.0 * r, confidence


def detect_plate(
    frame: np.ndarray,
    model: object | None = None,
) -> tuple[tuple[int, int] | None, float, float]:
    """Detect the plate center via the ONNX model if provided, else Hough."""
    if model is not None:
        result = model.detect(frame)  # type: ignore[attr-defined]
        if result.detections:
            det = max(result.detections, key=lambda d: d.confidence)
            x1, y1, x2, y2 = det.bbox
            center = ((x1 + x2) // 2, (y1 + y2) // 2)
            diameter = float(max(x2 - x1, y2 - y1))
            return center, diameter, det.confidence
        return None, 0.0, 0.0
    return detect_plate_hough(frame)


def track_clip(
    video_path: str | Path,
    model_path: str | Path | None = None,
    sample_rate: int = 1,
) -> TrackResult:
    """Track the plate/bar center across a clip and derive velocities.

    Velocities use the ACTUAL frame timestamps (frame_idx / fps read from the
    container), not an assumed fps. Vertical displacement is negated so that
    upward bar movement is positive meters (image +y is downward).

    Returns a TrackResult; mean/peak velocity are None when calibration or
    concentric-phase extraction is not possible (no plate found, no upward
    movement).
    """
    frames, timestamps = extract_frames(video_path, sample_rate=sample_rate)
    if len(frames) < 2:
        raise ValueError(f"Need >=2 frames, got {len(frames)} from {video_path}")

    model = None
    if model_path is not None and Path(model_path).exists():
        from .detector import PlateDetectorONNX

        model = PlateDetectorONNX(str(model_path))
        logger.info(f"Using ONNX detector: {model_path}")
    else:
        logger.warning("No ONNX model — using Hough-circle heuristic detector")

    h, w = frames[0].shape[:2]
    positions: list[tuple[float, float]] = []
    confidences: list[float] = []
    diameters: list[float] = []

    for frame in frames:
        center, diameter, confidence = detect_plate(frame, model)
        if center is None:
            # Mark as low-confidence; keep last known position so arrays stay
            # aligned — OOF handling will zero it out.
            center = positions[-1] if positions else (w / 2, h / 2)
            confidence = 0.0
            diameter = diameters[-1] if diameters else 0.0
        positions.append((float(center[0]), float(center[1])))
        confidences.append(confidence)
        if diameter > 0:
            diameters.append(diameter)

    positions_arr = np.asarray(positions)
    confidences_arr = np.asarray(confidences)
    timestamps_arr = np.asarray(timestamps, dtype=np.float64)

    plate_diameter_px = float(np.median(diameters)) if diameters else 0.0

    result = TrackResult(
        positions_px=positions_arr,
        confidences=confidences_arr,
        timestamps_s=timestamps_arr,
        plate_diameter_px=plate_diameter_px,
    )

    # OOF handling — never fabricate positions for unusable frames
    clean_pos, clean_conf, oof_idx = handle_out_of_frame(
        positions_arr, confidences_arr, w, h
    )
    result.oof_indices = oof_idx
    usable = clean_conf > 0
    if usable.sum() < 2 or plate_diameter_px <= 0:
        logger.warning("Not enough usable frames or no plate diameter — no velocity")
        return result

    ppm = calibrate_from_plate(plate_diameter_px)
    # Vertical displacement relative to first frame, y negated so up is +m
    disp_m = -(clean_pos[:, 1] - clean_pos[0, 1]) / ppm

    ts = timestamps_arr[usable]
    disp_usable = disp_m[usable]
    if len(ts) < 2:
        return result

    vel = compute_velocity(disp_usable, ts)
    result.velocity = vel

    start, end = extract_concentric_phase(disp_usable, ts)
    result.concentric_range = (start, end)
    if start < 0:
        logger.warning("No concentric phase found")
        return result

    phase = vel.time_series[start : end + 1]
    phase = phase[np.isfinite(phase)]
    if len(phase) == 0:
        return result
    result.mean_velocity = float(np.mean(np.abs(phase)))
    result.peak_velocity = float(np.max(np.abs(phase)))
    return result
