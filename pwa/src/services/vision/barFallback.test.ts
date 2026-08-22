// pwa/src/services/vision/barFallback.test.ts
// Unit tests for the pure pose-fallback blending logic.
// NOTE: written but NOT yet executed on this VPS — npm install fails because
// pwa/package-lock.json pins tarball URLs to Replit's internal registry
// (package-firewall.replit.local, unreachable). Run with:
//   npx vitest run --config ../vitest.config.ts   (from pwa/, after fixing deps)

import { describe, expect, it } from 'vitest';
import {
  POSE_HINT_CONFIDENCE_SCALE,
  blendBarPosition,
  wristMidpoint,
} from './barFallback';
import type { BarbellDetection, PoseLandmarks } from './types';

const lm = (x: number, y: number, visibility: number) => ({ x, y, z: 0, visibility });

const pose = (left: ReturnType<typeof lm>, right: ReturnType<typeof lm>): PoseLandmarks => ({
  landmarks: Array.from({ length: 33 }, (_, i) =>
    i === 15 ? left : i === 16 ? right : lm(0, 0, 0),
  ),
});

const contour = (over: Partial<BarbellDetection> = {}): BarbellDetection => ({
  x: 90,
  centerX: 100,
  centerY: 200,
  width: 20,
  height: 20,
  confidence: 0.8,
  ...over,
});

describe('wristMidpoint', () => {
  it('returns midpoint of visible wrists in pixel coords', () => {
    const m = wristMidpoint(pose(lm(0.2, 0.4, 0.9), lm(0.4, 0.6, 0.8)), 1000, 500);
    expect(m!.x).toBeCloseTo(300, 5);
    expect(m!.y).toBeCloseTo(250, 5);
  });

  it('returns null when a wrist is below visibility threshold', () => {
    expect(wristMidpoint(pose(lm(0.2, 0.4, 0.1), lm(0.4, 0.6, 0.8)), 1000, 500)).toBeNull();
  });

  it('returns null for missing landmarks', () => {
    expect(wristMidpoint(null, 1000, 500)).toBeNull();
    const short = { landmarks: [lm(0, 0, 1)] };
    expect(wristMidpoint(short as unknown as PoseLandmarks, 1000, 500)).toBeNull();
  });
});

describe('blendBarPosition', () => {
  it('blends both signals weighted by confidence', () => {
    const hint = { x: 200, y: 400 };
    const out = blendBarPosition(contour({ confidence: 0.6 }), hint);
    expect(out).not.toBeNull();
    // weights: contour 0.6 / (0.6 + 0.6*scale=0.36) ≈ 0.625
    const wC = 0.6 / (0.6 + POSE_HINT_CONFIDENCE_SCALE);
    expect(out!.centerX).toBeCloseTo(100 * wC + 200 * (1 - wC), 5);
    expect(out!.confidence).toBeCloseTo((0.6 + POSE_HINT_CONFIDENCE_SCALE) / 2, 5);
    expect(out!.x).toBeCloseTo(out!.centerX - 10, 5);
  });

  it('falls back to provisional pose-only detection when contour misses', () => {
    const out = blendBarPosition(null, { x: 150, y: 300 });
    expect(out).not.toBeNull();
    expect(out!.centerX).toBe(150);
    expect(out!.centerY).toBe(300);
    expect(out!.confidence).toBeCloseTo(POSE_HINT_CONFIDENCE_SCALE, 5);
  });

  it('passes through contour-only detections unchanged', () => {
    const c = contour();
    expect(blendBarPosition(c, null)).toEqual(c);
  });

  it('returns null when neither signal exists', () => {
    expect(blendBarPosition(null, null)).toBeNull();
  });

  it('high-confidence contour dominates a weak-ish pose hint', () => {
    const out = blendBarPosition(contour({ confidence: 0.95 }), { x: 900, y: 0 });
    expect(out!.centerX).toBeLessThan(450); // still near the contour position
  });
});
