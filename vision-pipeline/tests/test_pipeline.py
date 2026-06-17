"""Unit tests for vision pipeline — no video or model data needed."""

import numpy as np
import pytest

from vbt_vision.displacement import (
    OOFStrategy,
    calibrate_from_plate,
    compute_displacement,
    compute_total_distance,
    handle_out_of_frame,
    pixel_to_meters,
)
from vbt_vision.velocity import (
    VelocityResult,
    compute_velocity,
    detect_pauses,
    extract_concentric_phase,
)
from vbt_vision.metrics import (
    ValidationMetrics,
    compute_metrics,
    compute_metrics_per_exercise,
)


# ── Displacement ──

class TestCalibrateFromPlate:
    def test_standard_plate(self):
        # 45cm plate appears as 450px → 1000 px/m (450 / 0.45)
        ppm = calibrate_from_plate(450.0, 0.45)
        assert ppm == pytest.approx(1000.0)

    def test_close_up_plate(self):
        # Same plate closer: 900px → 2000 px/m (900 / 0.45)
        ppm = calibrate_from_plate(900.0, 0.45)
        assert ppm == pytest.approx(2000.0)

    def test_zero_diameter_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calibrate_from_plate(0.0)

    def test_negative_diameter_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calibrate_from_plate(-10.0)


class TestPixelToMeters:
    def test_scalar_conversion(self):
        pixels = np.array([100.0, 200.0, 50.0])
        meters = pixel_to_meters(pixels, 100.0)
        np.testing.assert_allclose(meters, [1.0, 2.0, 0.5])

    def test_2d_conversion(self):
        pixels = np.array([[100.0, 200.0], [50.0, 150.0]])
        meters = pixel_to_meters(pixels, 100.0)
        np.testing.assert_allclose(meters, [[1.0, 2.0], [0.5, 1.5]])


class TestComputeDisplacement:
    def test_relative_to_first_frame(self):
        positions = np.array([[100, 200], [110, 205], [130, 210]], dtype=float)
        disp = compute_displacement(positions, reference_idx=0)
        np.testing.assert_allclose(disp[0], [0, 0])
        np.testing.assert_allclose(disp[1], [10, 5])
        np.testing.assert_allclose(disp[2], [30, 10])

    def test_total_distance(self):
        displacement = np.array([[3.0, 4.0], [0.0, 0.0], [5.0, 12.0]])
        dist = compute_total_distance(displacement)
        np.testing.assert_allclose(dist, [5.0, 0.0, 13.0])


# ── Velocity ──

class TestComputeVelocity:
    def test_constant_velocity(self):
        # Object moving at 1 m/s for 1 second
        n = 10
        timestamps = np.linspace(0, 1, n)
        displacement = timestamps * 1.0  # 1 m/s

        result = compute_velocity(displacement, timestamps)
        # Central differences cause slight underestimate at boundaries
        assert result.mean_velocity == pytest.approx(1.0, abs=0.1)
        assert result.peak_velocity == pytest.approx(1.0, abs=0.1)

    def test_accelerating_movement(self):
        timestamps = np.linspace(0, 1, 100)
        displacement = timestamps ** 2  # accelerating

        result = compute_velocity(displacement, timestamps)
        # Mean should be between 0 and 1 m/s
        assert 0 < result.mean_velocity < 1.0
        assert result.peak_velocity > result.mean_velocity

    def test_smoothing_reduces_noise(self):
        timestamps = np.linspace(0, 1, 100)
        np.random.seed(42)
        displacement = timestamps * 1.0 + np.random.normal(0, 0.01, 100)

        result_raw = compute_velocity(displacement, timestamps, smoothing_window=1)
        result_smooth = compute_velocity(displacement, timestamps, smoothing_window=5)

        # Smoothed should have lower std
        assert np.std(result_smooth.time_series) < np.std(result_raw.time_series)

    def test_mismatched_lengths_raise(self):
        with pytest.raises(ValueError, match="same length"):
            compute_velocity(np.array([1, 2, 3]), np.array([1, 2]))

    def test_single_sample_raises(self):
        with pytest.raises(ValueError, match="at least 2"):
            compute_velocity(np.array([1.0]), np.array([0.0]))


class TestDetectPauses:
    def test_detects_stationary_period(self):
        # Fast movement then stopped then fast again
        velocity = np.array([0.5, 0.6, 0.01, 0.02, 0.01, 0.5, 0.6])
        displacement = np.cumsum(velocity) * 0.01
        timestamps = np.arange(len(velocity)) * 0.01

        pauses = detect_pauses(
            velocity, displacement, timestamps,
            velocity_threshold=0.05,
            min_pause_duration_s=0.01,  # lower threshold for test
        )
        # Frames 2, 3, 4 should be detected as pause
        assert 2 in pauses
        assert 3 in pauses
        assert 4 in pauses
        assert 0 not in pauses
        assert 5 not in pauses

    def test_no_pauses_when_always_moving(self):
        velocity = np.array([0.5, 0.6, 0.55, 0.52])
        displacement = np.cumsum(velocity) * 0.01
        timestamps = np.arange(len(velocity)) * 0.01

        pauses = detect_pauses(velocity, displacement, timestamps)
        assert len(pauses) == 0


class TestExtractConcentricPhase:
    def test_finds_upward_phase(self):
        # Simulate: rest → lift → rest
        displacement = np.concatenate([
            np.zeros(10),
            np.linspace(0, 0.5, 50),
            np.full(10, 0.5),
        ])
        timestamps = np.arange(len(displacement)) * 0.016  # ~60fps

        start, end = extract_concentric_phase(displacement, timestamps)
        assert start > 0  # Not the very beginning
        assert end < len(displacement)
        assert start < end


# ── Metrics ──

class TestComputeMetrics:
    def test_perfect_prediction(self):
        encoder = np.array([0.5, 0.6, 0.4, 0.7])
        vision = encoder.copy()

        metrics = compute_metrics(vision, encoder)
        assert metrics.rmse == pytest.approx(0.0, abs=1e-10)
        assert metrics.mae == pytest.approx(0.0, abs=1e-10)
        assert metrics.bias == pytest.approx(0.0, abs=1e-10)
        assert metrics.pearson_r == pytest.approx(1.0, abs=0.01)

    def test_constant_overestimate(self):
        encoder = np.array([0.5, 0.5, 0.5])
        vision = np.array([0.6, 0.6, 0.6])

        metrics = compute_metrics(vision, encoder)
        assert metrics.bias == pytest.approx(0.1, abs=1e-10)
        assert metrics.rmse == pytest.approx(0.1, abs=1e-10)

    def test_known_rmse(self):
        encoder = np.array([0.5, 0.6, 0.7])
        vision = np.array([0.55, 0.55, 0.75])

        metrics = compute_metrics(vision, encoder)
        expected_rmse = np.sqrt(np.mean([0.05**2, 0.05**2, 0.05**2]))
        assert metrics.rmse == pytest.approx(expected_rmse, abs=1e-10)

    def test_mismatched_lengths_raise(self):
        with pytest.raises(ValueError, match="same length"):
            compute_metrics(np.array([1, 2]), np.array([1]))

    def test_empty_arrays_raise(self):
        with pytest.raises(ValueError, match="Empty"):
            compute_metrics(np.array([]), np.array([]))


class TestComputeMetricsPerExercise:
    def test_per_exercise_breakdown(self):
        vision = np.array([0.5, 0.6, 0.3, 0.4])
        encoder = np.array([0.52, 0.58, 0.31, 0.38])
        exercises = ["Squat", "Squat", "Bench", "Bench"]

        metrics = compute_metrics_per_exercise(vision, encoder, exercises)
        assert "Squat" in metrics.per_exercise
        assert "Bench" in metrics.per_exercise
        assert metrics.per_exercise["Squat"].n_samples == 2
        assert metrics.per_exercise["Bench"].n_samples == 2

    def test_summary_format(self):
        vision = np.array([0.5, 0.6])
        encoder = np.array([0.52, 0.58])
        exercises = ["Squat", "Squat"]

        metrics = compute_metrics_per_exercise(vision, encoder, exercises)
        summary = metrics.summary()
        assert "n=2" in summary
        assert "RMSE=" in summary
