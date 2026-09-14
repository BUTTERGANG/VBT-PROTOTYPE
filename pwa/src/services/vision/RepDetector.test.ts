// pwa/src/services/vision/RepDetector.test.ts
// Unit tests for RepDetector rep segmentation + phase-aware velocity stats.
//
// Image-coordinate conventions (matching the implementation):
//   - Y grows DOWNWARD (0 = top of frame).
//   - A squat/bench rep: bar STARTS high (small Y), moves DOWN (Y increases,
//     eccentric), then moves UP (Y decreases, concentric), returning to rest.
//   - Velocity sign: positive = moving down (eccentric), negative = moving up
//     (concentric) — matches VelocityCalculator.

import { describe, expect, it } from 'vitest';
import { RepDetector } from './RepDetector';
import type { BarPosition } from './types';

const pos = (y: number, velocity = 0): BarPosition => ({
  x: 100,
  y,
  velocity,
  isValid: true,
  timestamp: 1000,
});

/**
 * Feed a full squat rep: rest at y=100 -> descend to y=300 (eccentric),
 * ascend back to y=100 (concentric), then rest. Returns the completed rep.
 */
function feedFullRep(
  detector: RepDetector,
  opts: {
    downVel?: number; // eccentric velocity (positive, downward)
    upVel?: number;   // concentric velocity (negative, upward)
  } = {},
) {
  const { downVel = 0.4, upVel = -0.6 } = opts;
  const rest = pos(100, 0);
  // A couple of rest frames first so the detector is in a settled pre-rep state.
  detector.addPosition(rest);
  detector.addPosition(rest);

  // Descend (eccentric): increasing Y, positive velocity.
  for (const y of [150, 200, 250, 300]) detector.addPosition(pos(y, downVel));
  // Bottom reversal frame.
  detector.addPosition(pos(300, 0));
  // Ascend (concentric): decreasing Y, negative velocity.
  for (const y of [250, 200, 150, 100]) detector.addPosition(pos(y, upVel));
  // Settle back at the top. restThreshold=1 means a single additional still
  // frame after movement trips completion, so the 2 rest frames finalize the rep.
  const r1 = detector.addPosition(pos(100, 0));
  const r2 = detector.addPosition(pos(100, 0));
  return r1 ?? r2;
}

describe('RepDetector rep segmentation', () => {
  it('detects a completed rep and reports correct distance', () => {
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    const rep = feedFullRep(d);

    expect(rep).not.toBeNull();
    expect(rep!.repNumber).toBe(1);
    // True amplitude is from start top (100) to bottom (300) = 200px.
    // Before the fix, peakY was stuck at 0 and distance inflated to ~300.
    expect(rep!.distance).toBe(200);
  });

  it('applies calibration: reports distance in mm and gates on real amplitude', () => {
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    // 1px = 0.5mm -> the 200px rep is 100mm < 150mm gate => rejected.
    d.setCalibration(2); // pixels per mm = 2 -> 200px = 100mm
    const smallRep = feedFullRep(d);
    expect(smallRep).toBeNull();

    // Recalibrate finer: 1px = 0.4mm -> 200px = 500mm >= 150mm gate => accepted.
    const d2 = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    d2.setCalibration(0.4); // 200px = 500mm
    const rep = feedFullRep(d2);
    expect(rep).not.toBeNull();
    expect(rep!.distance).toBeGreaterThanOrEqual(500);
    expect(rep!.distance).toBeCloseTo(500, 5);
  });

  it('returns null for movement too small to be a rep', () => {
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    const rest = pos(100, 0);
    d.addPosition(rest);
    d.addPosition(rest);
    // Small 20px bob — below 150px threshold (uncalibrated: px treated as mm).
    for (const y of [110, 120, 110, 100]) d.addPosition(pos(y, 0.4));
    const r1 = d.addPosition(pos(100, 0));
    const r2 = d.addPosition(pos(100, 0));
    const rep = r1 ?? r2;
    expect(rep).toBeNull();
    expect(d.getRepCount()).toBe(0);
  });
});

describe('RepDetector phase-aware concentric velocity', () => {
  it('computes mean/peak over the CONCENTRIC phase only', () => {
    const downVel = 1.0;   // fast eccentric
    const upVel = -0.5;    // slower concentric
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    const rep = feedFullRep(d, { downVel, upVel });

    expect(rep).not.toBeNull();
    // Concentric velocities: ascending [250,200,150,100] with upVel -0.5.
    // |v| = 0.5 throughout -> mean 0.5, peak 0.5.
    // If eccentric (|1.0|) had leaked in, mean and peak would be wrong.
    expect(rep!.meanConcentricVelocity).toBeCloseTo(0.5, 5);
    expect(rep!.peakConcentricVelocity).toBeCloseTo(0.5, 5);
  });

  it('never reports the (faster) eccentric phase as peak velocity', () => {
    const downVel = 1.2; // eccentric faster than concentric
    const upVel = -0.4;
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    const rep = feedFullRep(d, { downVel, upVel });

    expect(rep).not.toBeNull();
    // Regression: before the fix the consumer took max over ALL phases and
    // would have reported peak = 1.2 (the eccentric descent). Concentric-only
    // peak must be 0.4.
    expect(rep!.peakConcentricVelocity).toBeCloseTo(0.4, 5);
    expect(rep!.meanConcentricVelocity).toBeCloseTo(0.4, 5);
  });

  it('produces a sensible mean across varied concentric velocities', () => {
    const d = new RepDetector({ minRepDistanceMm: 150, restThreshold: 1 });
    // Descend slowly, then ascend at varying speeds.
    const rest = pos(100, 0);
    d.addPosition(rest);
    d.addPosition(rest);
    for (const y of [160, 220, 280]) d.addPosition(pos(y, 0.4));
    d.addPosition(pos(280, 0));
    // Concentric velocities: -0.5, -0.7, -0.9, -0.6  (mean = 0.675, peak = 0.9)
    const ascY = [240, 200, 160, 100];
    const ascV = [-0.5, -0.7, -0.9, -0.6];
    for (let i = 0; i < ascY.length; i++) d.addPosition(pos(ascY[i], ascV[i]));
    const r1 = d.addPosition(pos(100, 0));
    const r2 = d.addPosition(pos(100, 0));
    const rep = r1 ?? r2;

    expect(rep).not.toBeNull();
    expect(rep!.meanConcentricVelocity).toBeCloseTo((0.5 + 0.7 + 0.9 + 0.6) / 4, 5);
    expect(rep!.peakConcentricVelocity).toBeCloseTo(0.9, 5);
  });
});
