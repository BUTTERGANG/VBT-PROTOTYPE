#!/usr/bin/env python3
"""Render a tracked bar-path overlay for a clip.

Runs the pipeline (ONNX detector if available, else Hough-circle heuristic)
over every frame, draws the tracked bar-center path and per-frame confidence
onto the frames, and writes an annotated MP4 next to the input
(e.g. squat_001.mp4 -> squat_001.tracked.mp4). Uses cv2.VideoWriter with the
mp4v codec — safe in headless environments.

Usage:
    python scripts/render_overlay.py data/videos/squat_001.mp4 \
        [--model models/plate_detector.onnx] [--sample-rate 1]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import cv2

# Allow running from repo root without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vision-pipeline" / "src"))

from vbt_vision.tracking import detect_plate
from vbt_vision.video_io import extract_frames

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("render_overlay")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--model", type=Path, default=None,
                        help="optional ONNX plate-detector model path")
    parser.add_argument("--sample-rate", type=int, default=1)
    parser.add_argument("--suffix", default=".tracked")
    args = parser.parse_args()

    if not args.video.exists():
        print(f"ERROR: video not found: {args.video}")
        return 1

    model = None
    if args.model is not None and args.model.exists():
        from vbt_vision.detector import PlateDetectorONNX

        model = PlateDetectorONNX(str(args.model))
        log.info("Using ONNX detector: %s", args.model)
    else:
        log.warning("No ONNX model supplied/found — overlay will use the "
                    "Hough-circle heuristic detector")

    frames, timestamps = extract_frames(args.video, sample_rate=args.sample_rate)
    if len(frames) < 2:
        print(f"ERROR: need >=2 frames, got {len(frames)}")
        return 1

    h, w = frames[0].shape[:2]

    # First pass: track centers + confidences
    centers: list[tuple[int, int] | None] = []
    confidences: list[float] = []
    for i, frame in enumerate(frames):
        center, _diameter, conf = detect_plate(frame, model)
        centers.append(center)
        confidences.append(conf)
        if center is None:
            log.info("frame %d: no detection (conf=0)", i)

    out_path = args.video.with_name(args.video.stem + args.suffix + ".mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")  # type: ignore[attr-defined]
    writer = cv2.VideoWriter(str(out_path), fourcc,
                             _fps_of(args.video) / args.sample_rate, (w, h))
    if not writer.isOpened():
        print(f"ERROR: could not open VideoWriter for {out_path}")
        return 1

    path_points = [c for c in centers if c is not None]
    try:
        for i, frame in enumerate(frames):
            canvas = frame.copy()
            # Draw path so far (fading polyline of recent history)
            for j in range(1, len(path_points[: i + 1])):
                cv2.line(canvas, path_points[j - 1], path_points[j],
                         (0, 220, 255), 2)
            c = centers[i]
            if c is not None:
                cv2.circle(canvas, c, 6, (0, 0, 255), -1)
            label = f"conf={confidences[i]:.2f} t={timestamps[i]:.2f}s"
            cv2.putText(canvas, label, (10, 28), cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (255, 255, 255), 2, cv2.LINE_AA)
            writer.write(canvas)
    finally:
        writer.release()

    n_det = sum(c is not None for c in centers)
    print(f"Wrote {out_path} ({n_det}/{len(frames)} frames with detections)")
    return 0


def _fps_of(video: Path) -> float:
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return fps if fps > 0 else 30.0


if __name__ == "__main__":
    sys.exit(main())
