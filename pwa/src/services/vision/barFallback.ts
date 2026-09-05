// src/services/vision/barFallback.ts
//
// Pure helpers for pose-based bar-position fallback.
// Unit-tested via barFallback.test.ts (`npx vitest run`).

import type { BarbellDetection, PoseLandmarks } from './types';

export type { PoseLandmarks };

/** MediaPipe pose landmark indices for the wrists */
export const LEFT_WRIST = 15;
export const RIGHT_WRIST = 16;

/** Minimum per-landmark visibility to trust a wrist position */
export const WRIST_MIN_VISIBILITY = 0.5;

/**
 * Midpoint of the two wrists in canvas pixel coordinates.
 * In a side-view lift the hands grip the bar, so the wrist midpoint is a
 * physically grounded proxy for bar position — far more robust than the
 * contour detector's tendency to lock onto plates, racks, or shadows.
 *
 * Returns null when either wrist is missing or below visibility threshold,
 * so callers never receive an invented position.
 */
export function wristMidpoint(
  landmarks: PoseLandmarks | null | undefined,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } | null {
  if (!landmarks || landmarks.landmarks.length <= Math.max(LEFT_WRIST, RIGHT_WRIST)) {
    return null;
  }
  const left = landmarks.landmarks[LEFT_WRIST];
  const right = landmarks.landmarks[RIGHT_WRIST];
  if (!left || !right) return null;
  if (left.visibility < WRIST_MIN_VISIBILITY || right.visibility < WRIST_MIN_VISIBILITY) {
    return null;
  }
  return {
    x: ((left.x + right.x) / 2) * canvasWidth,
    y: ((left.y + right.y) / 2) * canvasHeight,
  };
}

/** How much we discount a pose-derived position vs a real plate detection */
export const POSE_HINT_CONFIDENCE_SCALE = 0.6;

/**
 * Blend a contour-detector detection with a pose-based bar hint, weighted by
 * confidence. Rules:
 * - Both present: convex combination of centers weighted by confidence;
 *   blended confidence is the mean (conservative).
 * - Only pose present (contour missed / jumped objects): pose midpoint with
 *   discounted confidence, so downstream treats it as provisional.
 * - Only contour present: unchanged.
 * - Neither: null.
 */
export function blendBarPosition(
  contour: BarbellDetection | null | undefined,
  poseHint: { x: number; y: number } | null | undefined,
): BarbellDetection | null {
  const poseConf = poseHint ? POSE_HINT_CONFIDENCE_SCALE : 0;

  if (contour && poseHint) {
    const wC = contour.confidence / (contour.confidence + poseConf);
    const centerX = contour.centerX * wC + poseHint.x * (1 - wC);
    const centerY = contour.centerY * wC + poseHint.y * (1 - wC);
    return {
      ...contour,
      x: centerX - contour.width / 2,
      centerX,
      centerY,
      confidence: (contour.confidence + poseConf) / 2,
    };
  }

  if (!contour && poseHint) {
    // Provisional pose-only detection
    return {
      x: poseHint.x - 30,
      centerX: poseHint.x,
      centerY: poseHint.y,
      width: 60,
      height: 60,
      confidence: poseConf,
    };
  }

  return contour ?? null;
}
