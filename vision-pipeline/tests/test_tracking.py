"""Integration tests for vbt_vision.tracking using a synthetic clip.

Generates a tiny mp4 in-tmpdir with cv2.VideoWriter (mp4v, headless-safe):
a dark plate translating upward at known constant velocity.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest
from vbt_vision.tracking import detect_plate_hough, track_clip

FPS = 30.0
W, H = 480, 360
RADIUS = 60  # px → diameter 120 px; ppm = 120/0.45 ≈ 266.7
VELOCITY_MS = 0.5
PPM = RADIUS * 2 / 0.45


@pytest.fixture(scope="module")
def synthetic_clip(tmp_path_factory):
    path = tmp_path_factory.mktemp("videos") / "synth.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"),
                             FPS, (W, H))
    assert writer.isOpened()
    y0 = H - RADIUS - 10
    n = int(FPS)  # 1 second: plate rises exactly VELOCITY_MS meters
    for i in range(n):
        frame = np.full((H, W, 3), 235, dtype=np.uint8)
        y = round(y0 - VELOCITY_MS * PPM * i / FPS)
        cv2.circle(frame, (W // 3, y), RADIUS, (40, 40, 40), -1)
        cv2.circle(frame, (W // 3, y), RADIUS, (15, 15, 15), 3)
        writer.write(frame)
    writer.release()
    return path


def test_hough_finds_plate_center():
    frame = np.full((H, W, 3), 235, dtype=np.uint8)
    cv2.circle(frame, (150, 200), RADIUS, (40, 40, 40), -1)
    center, diameter, conf = detect_plate_hough(frame)
    assert center is not None
    assert abs(center[0] - 150) < 10
    assert abs(center[1] - 200) < 10
    assert diameter == pytest.approx(2 * RADIUS, rel=0.25)
    assert conf > 0


def test_hough_returns_none_on_blank():
    frame = np.full((H, W, 3), 235, dtype=np.uint8)
    center, diameter, _ = detect_plate_hough(frame)
    assert center is None and diameter == 0.0


def test_track_clip_recovers_constant_velocity(synthetic_clip):
    result = track_clip(synthetic_clip)
    # Timestamps come from actual frame indices / fps
    np.testing.assert_allclose(result.timestamps_s[:3], [0.0, 1 / FPS, 2 / FPS])
    # Calibration from detected plate diameter
    assert result.plate_diameter_px == pytest.approx(2 * RADIUS, rel=0.25)
    # Constant velocity → MV should match within 15%
    assert result.mean_velocity is not None
    assert result.mean_velocity == pytest.approx(VELOCITY_MS, rel=0.15)


def test_track_clip_needs_two_frames(tmp_path):
    single = tmp_path / "single.mp4"
    writer = cv2.VideoWriter(str(single), cv2.VideoWriter_fourcc(*"mp4v"),
                             FPS, (W, H))
    writer.write(np.full((H, W, 3), 235, dtype=np.uint8))  # exactly 1 frame
    writer.release()
    with pytest.raises(ValueError, match=">=2 frames"):
        track_clip(single)
