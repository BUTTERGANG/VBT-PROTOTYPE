#!/usr/bin/env python3
"""Generate a synthetic side-view lift clip for smoke-testing the harness.

Draws a dark circular plate translating upward at constant velocity on a
light background — enough for the Hough fallback tracker to lock onto.

Usage: python scripts/make_synthetic_clip.py data/videos/squat_001.mp4 \
           [--fps 30] [--seconds 2] [--velocity-ms 0.5] [--ppm 500]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="output .mp4 path")
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--seconds", type=float, default=2.0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--velocity-ms", type=float, default=0.5,
                        help="upward plate velocity in m/s")
    parser.add_argument("--ppm", type=float, default=500.0,
                        help="pixels per meter (sets plate radius & speed)")
    parser.add_argument("--plate-diameter-m", type=float, default=0.45)
    args = parser.parse_args()

    n_frames = int(args.fps * args.seconds)
    radius_px = int(args.plate_diameter_m * args.ppm / 2)
    speed_px = args.velocity_ms * args.ppm  # px per second upward

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(args.output), fourcc, args.fps,
                          (args.width, args.height))
    if not out.isOpened():
        print(f"ERROR: could not open VideoWriter for {args.output}")
        return 1

    y0 = args.height - radius_px - 20  # start near bottom
    for i in range(n_frames):
        frame = np.full((args.height, args.width, 3), 235, dtype=np.uint8)
        # some background clutter
        cv2.rectangle(frame, (0, args.height - 10), (args.width, args.height),
                      (120, 120, 120), -1)
        y = round(y0 - speed_px * i / args.fps)
        cv2.circle(frame, (args.width // 3, y), radius_px, (40, 40, 40), -1)
        cv2.circle(frame, (args.width // 3, y), radius_px, (15, 15, 15), 4)
        cv2.circle(frame, (args.width // 3, y), max(3, radius_px // 8),
                   (200, 200, 200), -1)  # hub
        out.write(frame)
    out.release()
    print(f"Wrote {n_frames} frames -> {args.output} "
          f"(plate r={radius_px}px, {args.velocity_ms} m/s up)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
