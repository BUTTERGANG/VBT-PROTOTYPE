"""Regression tests for audited miscalculations in vbt_vision."""

import numpy as np
import pytest
from vbt_vision.displacement import handle_out_of_frame
from vbt_vision.metrics import ccc, compute_metrics
from vbt_vision.velocity import compute_velocity, extract_concentric_phase


class TestOOFNoFabricatedPositions:
    """OOF frames that cannot be interpolated must not keep raw positions
    with nonzero confidence — downstream treats confidence > 0 as usable."""

    def test_oversized_gap_gets_zero_confidence(self):
        # 10-frame gap, max_gap=3 → too large to interpolate.
        positions = np.linspace([[100, 500]], [[100, 400]], 20).reshape(20, 2)
        conf = np.full(20, 0.9)
        oof = np.zeros(20, dtype=bool)
        oof[5:15] = True  # low-confidence stretch (simulated below)
        conf[oof] = 0.1

        _clean_pos, clean_conf, _ = handle_out_of_frame(
            positions, np.where(oof, 0.1, conf),
            frame_width=1280, frame_height=720,
            strategy="interpolate", max_gap_frames=3,
            confidence_floor=0.3,
        )
        # Every originally-OOF frame must end with confidence 0
        assert np.all(clean_conf[oof] == 0.0)

    def test_boundary_gap_gets_zero_confidence(self):
        # Gap at the very start: no "before" frame exists → not interpolatable
        positions = np.full((20, 2), [640.0, 360.0])
        conf = np.full(20, 0.9)
        conf[:4] = 0.1  # OOF at start

        _, clean_conf, _ = handle_out_of_frame(
            positions, conf,
            frame_width=1280, frame_height=720,
            strategy="interpolate", max_gap_frames=10,
            confidence_floor=0.3,
        )
        assert np.all(clean_conf[:4] == 0.0)
        assert np.all(clean_conf[4:] == 0.9)

    def test_small_interior_gap_is_interpolated(self):
        positions = np.column_stack([
            np.arange(20, dtype=float) * 10 + 100,
            np.full(20, 360.0),
        ])
        conf = np.full(20, 0.9)
        conf[8:11] = 0.1

        clean_pos, clean_conf, _ = handle_out_of_frame(
            positions, conf,
            frame_width=1280, frame_height=720,
            strategy="interpolate", max_gap_frames=5,
            confidence_floor=0.3,
        )
        # Interpolated frames get marked confidence and lie on the line
        assert np.all(clean_conf[8:11] > 0.0)
        np.testing.assert_allclose(
            clean_pos[8:11, 0], [180.0, 190.0, 200.0], atol=1e-9
        )


class TestNaNsafeSmoothing:
    """A single dt==0 (duplicated timestamp) used to poison ±window neighbors
    via np.convolve NaN propagation."""

    def test_duplicated_timestamp_does_not_poison_neighbors(self):
        n = 30
        ts = np.arange(n) / 30.0
        ts[15] = ts[14]  # duplicated timestamp → dt == 0
        disp = ts * 0.8

        result = compute_velocity(disp, ts, smoothing_window=3)
        vel = result.time_series
        # Neighbors of the bad sample must stay finite
        assert np.isfinite(np.delete(vel, [14, 15])).all()

    def test_mean_and_peak_still_finite_with_duplicate_ts(self):
        ts = np.array([0.0, 0.1, 0.2, 0.2, 0.3, 0.4])
        disp = ts * 1.0
        result = compute_velocity(disp, ts)
        assert np.isfinite(result.mean_velocity)
        assert np.isfinite(result.peak_velocity)


class TestConcentricPhaseNoise:
    """A one-sample noise dip mid-lift used to truncate/miss the phase."""

    def test_single_sample_dip_does_not_split_phase(self):
        # Steady 1 m/s lift with one noisy near-zero sample in the middle
        n = 60
        ts = np.arange(n) / 60.0
        disp = ts * 1.0
        disp[30] = disp[29] - 0.001  # noise dip → local velocity < threshold

        start, end = extract_concentric_phase(disp, ts, velocity_threshold=0.02)
        assert start <= 2
        assert end >= n - 3

    def test_no_upward_motion_returns_sentinel(self):
        ts = np.arange(20) / 60.0
        disp = -ts * 0.5  # purely downward
        start, end = extract_concentric_phase(disp, ts)
        assert start == -1 and end == -1


class TestCCC:
    def test_perfect_agreement(self):
        x = np.array([0.4, 0.5, 0.6, 0.7])
        assert ccc(x, x) == pytest.approx(1.0)

    def test_known_value(self):
        vision = np.array([0.5, 0.6, 0.7])
        encoder = np.array([0.55, 0.55, 0.75])
        # Hand-computed: means 0.6/0.6167, vars, etc. Just sanity-range it here
        # and verify exact identity against the definition.
        mx, my = vision.mean(), encoder.mean()
        sxx, syy = vision.var(), encoder.var()
        sxy = ((vision - mx) * (encoder - my)).mean()
        expected = 2 * sxy / (sxx + syy + (mx - my) ** 2)
        assert ccc(vision, encoder) == pytest.approx(expected)

    def test_in_compute_metrics_summary(self):
        m = compute_metrics(np.array([0.5, 0.6]), np.array([0.52, 0.58]))
        assert hasattr(m, "ccc")
