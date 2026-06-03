// src/services/vision/VelocityCalculator.ts

import type { BarPosition } from './types';

/**
 * Converts tracked barbell pixel positions into real-world velocity (m/s).
 *
 * Pipeline:
 * 1. Accumulate raw positions from BarbellDetector
 * 2. Convert pixel displacement to millimeters using calibration
 * 3. Apply Kalman-like smoothing to reduce jitter
 * 4. Output BarPosition with velocity in m/s
 */
export class VelocityCalculator {
  private positions: Array<{ x: number; y: number; timestamp: number }> = [];
  private pixelsPerMm: number = 0;
  private smoothingWindow: number;
  private maxPositions: number = 300; // Keep last 10 seconds at 30fps

  // Kalman filter state
  private kalmanX = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
  private kalmanY = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };

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
   * Returns a BarPosition if velocity could be calculated, null otherwise.
   */
  processDetection(x: number, y: number, timestamp: number): BarPosition | null {
    // Apply Kalman filter to smooth position
    const smoothX = this.kalmanUpdate(this.kalmanX, x);
    const smoothY = this.kalmanUpdate(this.kalmanY, y);

    this.positions.push({ x: smoothX, y: smoothY, timestamp });

    // Trim old positions
    if (this.positions.length > this.maxPositions) {
      this.positions = this.positions.slice(-this.maxPositions);
    }

    // Need at least 2 positions to calculate velocity
    if (this.positions.length < 2) {
      return { x: smoothX, y: smoothY, velocity: 0, isValid: true, timestamp };
    }

    // Calculate velocity from recent positions
    const velocity = this.calculateVelocity();

    return {
      x: smoothX,
      y: smoothY,
      velocity,
      isValid: true,
      timestamp,
    };
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
    }));
  }

  /**
   * Reset the calculator state.
   */
  reset(): void {
    this.positions = [];
    this.kalmanX = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
    this.kalmanY = { estimate: 0, error: 1, processNoise: 0.01, measurementNoise: 0.1 };
  }

  // --- Private: Kalman filter ---

  private kalmanUpdate(
    state: { estimate: number; error: number; processNoise: number; measurementNoise: number },
    measurement: number
  ): number {
    // Predict
    const predictedError = state.error + state.processNoise;

    // Update
    const kalmanGain = predictedError / (predictedError + state.measurementNoise);
    state.estimate = state.estimate + kalmanGain * (measurement - state.estimate);
    state.error = (1 - kalmanGain) * predictedError;

    return state.estimate;
  }

  // --- Private: Velocity calculation ---

  /**
   * Calculate instantaneous velocity from the most recent positions.
   * Uses a rolling window for smoothing.
   */
  private calculateVelocity(): number {
    const n = this.positions.length;
    const window = Math.min(this.smoothingWindow, n - 1);
    if (window < 1) return 0;

    const recent = this.positions[n - 1];
    const past = this.positions[n - 1 - window];

    const dt = (recent.timestamp - past.timestamp) / 1000; // seconds
    if (dt <= 0) return 0;

    const dx = recent.x - past.x;
    const dy = recent.y - past.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    // Convert to real-world velocity
    if (this.pixelsPerMm <= 0) return 0;

    const mmDistance = pixelDistance / this.pixelsPerMm;
    const metersDistance = mmDistance / 1000;

    return metersDistance / dt;
  }

  /**
   * Calculate velocity at a specific position index.
   */
  private calculateVelocityAt(index: number): number {
    if (index <= 0 || index >= this.positions.length) return 0;

    const window = Math.min(this.smoothingWindow, index);
    const current = this.positions[index];
    const past = this.positions[index - window];

    const dt = (current.timestamp - past.timestamp) / 1000;
    if (dt <= 0) return 0;

    const dx = current.x - past.x;
    const dy = current.y - past.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    if (this.pixelsPerMm <= 0) return 0;

    return (pixelDistance / this.pixelsPerMm / 1000) / dt;
  }
}
