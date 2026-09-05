// src/services/vision/VelocityCalculator.ts

import type { BarPosition } from './types';

/**
 * Converts tracked barbell pixel positions into real-world velocity (m/s).
 *
 * Pipeline:
 * 1. Accumulate raw positions from BarbellDetector
 * 2. Convert pixel displacement to millimeters using calibration
 * 3. Apply adaptive Kalman-like smoothing to reduce jitter
 * 4. Output BarPosition with signed velocity in m/s
 *
 * Research-backed improvements (2026-06-17):
 * - Signed velocity: preserves direction (positive = bar moving down in image
 *   coords = eccentric phase for squat/bench). Renner 2024 showed that using
 *   absolute velocity inflates noise from horizontal jitter.
 * - Adaptive Kalman: measurement noise scales with detection confidence.
 *   Low-confidence detections are smoothed more aggressively.
 * - Peak velocity tracking: PV is the most robust metric (Grossi 2026:
 *   PV r=0.91 at 1-RM while MV dropped to ρ=0.65). Track PV per-rep.
 */
export class VelocityCalculator {
  private positions: Array<{ x: number; y: number; timestamp: number }> = [];
  private pixelsPerMm: number = 0;
  private smoothingWindow: number;
  private maxPositions: number = 300;

  // Adaptive Kalman filter state
  private kalmanX = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
  private kalmanY = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };

  // Peak velocity tracking (research: PV is most robust metric)
  private peakVelocity = 0;
  private repStartFrame = 0;

  constructor(smoothingWindow: number = 5) {
    this.smoothingWindow = smoothingWindow;
  }

  /**
   * Set the calibration factor (pixels per millimeter).
   */
  setCalibration(pixelsPerMm: number): void {
    this.pixelsPerMm = pixelsPerMm;
  }

  /**
   * Process a new detection and calculate velocity.
   * Returns a BarPosition with signed velocity (positive = downward in image).
   */
  processDetection(x: number, y: number, timestamp: number, confidence: number = 0.8): BarPosition | null {
    // Adaptive Kalman: scale measurement noise inversely with confidence
    // Low confidence → high measurement noise → less trust in new detection
    const adaptiveMeasurementNoise = 0.1 / Math.max(confidence, 0.1);

    const smoothX = this.kalmanUpdate(this.kalmanX, x, adaptiveMeasurementNoise);
    const smoothY = this.kalmanUpdate(this.kalmanY, y, adaptiveMeasurementNoise);

    this.positions.push({ x: smoothX, y: smoothY, timestamp });

    if (this.positions.length > this.maxPositions) {
      this.positions = this.positions.slice(-this.maxPositions);
    }

    if (this.positions.length < 2) {
      return { x: smoothX, y: smoothY, velocity: 0, isValid: true, timestamp };
    }

    const velocity = this.calculateVelocity();

    // Track peak velocity (absolute value, since direction changes mid-rep)
    const absVel = Math.abs(velocity);
    if (absVel > this.peakVelocity) {
      this.peakVelocity = absVel;
    }

    return {
      x: smoothX,
      y: smoothY,
      velocity,
      isValid: true,
      timestamp,
    };
  }

  /**
   * Get the peak velocity seen since reset() or startOfRep().
   * Research: PV is the most robust velocity metric across all intensity zones
   * (Grossi 2026: PV r=0.91 at 1-RM vs MV ρ=0.65).
   */
  getPeakVelocity(): number {
    return this.peakVelocity;
  }

  /**
   * Mark the start of a new rep — resets peak velocity tracking.
   */
  startOfRep(): void {
    this.peakVelocity = 0;
    this.repStartFrame = this.positions.length;
  }

  /**
   * Get the current bar path (all recent positions).
   */
  getPath(): BarPosition[] {
    return this.positions.map((p, i) => ({
      x: p.x,
      y: p.y,
      velocity: i > 0 ? this.calculateVelocityAt(i) : 0,
      isValid: true,
      timestamp: p.timestamp,
    }));
  }

  /**
   * Reset the calculator state.
   */
  reset(): void {
    this.positions = [];
    this.kalmanX = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
    this.kalmanY = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
    this.peakVelocity = 0;
    this.repStartFrame = 0;
  }

  // --- Private: Adaptive Kalman filter ---

  private kalmanUpdate(
    state: { estimate: number; error: number; processNoise: number; measurementNoise: number },
    measurement: number,
    adaptiveMeasurementNoise: number
  ): number {
    // Predict
    const predictedError = state.error + state.processNoise;

    // Update with adaptive measurement noise
    const effectiveNoise = Math.max(adaptiveMeasurementNoise, state.measurementNoise);
    const kalmanGain = predictedError / (predictedError + effectiveNoise);
    state.estimate = state.estimate + kalmanGain * (measurement - state.estimate);
    state.error = (1 - kalmanGain) * predictedError;

    return state.estimate;
  }

  // --- Private: Velocity calculation ---

  /**
   * Calculate signed velocity from the most recent positions.
   * Positive = bar moving down (image Y increases) = eccentric for most lifts.
   */
  private calculateVelocity(): number {
    const n = this.positions.length;
    const window = Math.min(this.smoothingWindow, n - 1);
    if (window < 1) return 0;

    const recent = this.positions[n - 1];
    const past = this.positions[n - 1 - window];

    const dt = (recent.timestamp - past.timestamp) / 1000;
    if (dt <= 0) return 0;

    // Signed vertical velocity (Y-only eliminates horizontal noise)
    const dyPx = recent.y - past.y;
    if (this.pixelsPerMm <= 0) return 0;

    const mmDistance = dyPx / this.pixelsPerMm;
    const metersDistance = mmDistance / 1000;

    return metersDistance / dt;
  }

  private calculateVelocityAt(index: number): number {
    if (index <= 0 || index >= this.positions.length) return 0;

    const window = Math.min(this.smoothingWindow, index);
    const current = this.positions[index];
    const past = this.positions[index - window];

    const dt = (current.timestamp - past.timestamp) / 1000;
    if (dt <= 0) return 0;

    const dyPx = current.y - past.y;
    if (this.pixelsPerMm <= 0) return 0;

    return (dyPx / this.pixelsPerMm / 1000) / dt;
  }
}
