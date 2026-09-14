// pwa/src/services/vision/VelocityCalculator.test.ts
// Unit tests for pixel -> m/s velocity conversion + peak-velocity tracking.

import { describe, expect, it } from 'vitest';
import { VelocityCalculator } from './VelocityCalculator';

const MS_PER_SEC = 1000;

describe('VelocityCalculator', () => {
  it('returns zero velocity until calibration is set', () => {
    const vc = new VelocityCalculator(2);
    const out = vc.processDetection(100, 100, 0);
    expect(out!.velocity).toBe(0);
  });

  it('converts pixel displacement to m/s using pixelsPerMm', () => {
    const vc = new VelocityCalculator(2);
    // 4 px/mm at the bar plane. Downward movement of 40px over 0.2s:
    // 40px / 4 (px/mm) = 10mm = 0.01m over 0.2s = 0.05 m/s.
    vc.setCalibration(4);

    vc.processDetection(100, 100, 0 * MS_PER_SEC);
    // The first sample only establishes the base (velocity 0).
    const second = vc.processDetection(100, 140, 0.2 * MS_PER_SEC);

    expect(second!.velocity).toBeCloseTo(0.05, 5);
  });

  it('signs upward movement negative (concentric)', () => {
    const vc = new VelocityCalculator(2);
    vc.setCalibration(4);
    vc.processDetection(100, 140, 0 * MS_PER_SEC);
    // Move UP: Y decreases by 40px over 0.2s -> -0.05 m/s.
    const up = vc.processDetection(100, 100, 0.2 * MS_PER_SEC);
    expect(up!.velocity).toBeLessThan(0);
    expect(up!.velocity).toBeCloseTo(-0.05, 5);
  });

  it('tracks peak velocity as the max absolute magnitude', () => {
    const vc = new VelocityCalculator(1); // window 1 -> per-frame velocity
    vc.setCalibration(4);
    // (100,100)@0 ; (100,120)@0.1 ; (100,140)@0.2 ; (100,100)@0.3 ; (100,180)@0.4
    // Per-frame velocities: +0.05, +0.05, -0.1, +0.2  -> peak = 0.2.
    const steps = [
      { y: 100, t: 0.0 },
      { y: 120, t: 0.1 },
      { y: 140, t: 0.2 },
      { y: 100, t: 0.3 },
      { y: 180, t: 0.4 },
    ];
    for (const s of steps) {
      vc.processDetection(100, s.y, s.t * MS_PER_SEC);
    }
    expect(vc.getPeakVelocity()).toBeCloseTo(0.2, 5);
  });

  it('resets peak velocity on startOfRep', () => {
    const vc = new VelocityCalculator(1);
    vc.setCalibration(4);
    vc.processDetection(100, 100, 0);
    vc.processDetection(100, 180, 0.1 * MS_PER_SEC); // +0.2 m/s
    expect(vc.getPeakVelocity()).toBeCloseTo(0.2, 5);

    vc.startOfRep();
    expect(vc.getPeakVelocity()).toBe(0);
  });
});
