// src/services/vision/RepDetector.ts

import type { BarPosition, RepPhase } from './types';

/**
 * Detects individual reps from a continuous bar path.
 *
 * Algorithm:
 * 1. Track bar Y position over time
 * 2. Detect direction changes (top/bottom of rep)
 * 3. Segment into eccentric (down) and concentric (up) phases
 * 4. Filter out noise (small movements, unracking, etc.)
 * 5. Output rep boundaries with phase data
 *
 * In image coordinates, Y increases downward, so:
 * - Bar moving DOWN = increasing Y = eccentric (for squat)
 * - Bar moving UP = decreasing Y = concentric (for squat)
 *
 * Velocity convention matches VelocityCalculator: positive = bar moving DOWN
 * (eccentric), negative = bar moving UP (concentric). Phase-aware stats
 * (meanConcentricVelocity / peakConcentricVelocity) are computed over the
 * CONCENTRIC phase only, which is the physically meaningful window for VBT
 * (mean/peak velocity of the lift), so consumers never average eccentric +
 * concentric together.
 */
export class RepDetector {
  private positions: BarPosition[] = [];
  private phase: RepPhase = 'idle';
  private repCount = 0;
  private currentRepStart = 0;

  // Thresholds
  /** Minimum rep amplitude in real-world millimeters (calibration-aware). */
  private minRepDistanceMm: number;
  private directionThreshold: number; // Min pixel displacement to count as movement
  private restThreshold: number; // Frames of stillness to consider "at rest"
  /** Pixels per millimeter at the bar plane; set via setCalibration(). */
  private pixelsPerMm = 0;

  // State tracking
  private directionChanges = 0;
  private framesStill = 0;
  private peakY = 0;
  private valleyY = 0;
  /** Index (into this.positions) where the current rep's CONCENTRIC phase began. */
  private concentricStart = 0;

  constructor(options?: {
    minRepDistanceMm?: number;
    directionThreshold?: number;
    restThreshold?: number;
  }) {
    this.minRepDistanceMm = options?.minRepDistanceMm ?? 150;
    this.directionThreshold = options?.directionThreshold ?? 0.02;
    this.restThreshold = options?.restThreshold ?? 15;
  }

  /**
   * Set the calibration factor (pixels per mm). Must be set before rep
   * distance (checked against minRepDistanceMm in real mm) is meaningful.
   * Call whenever the VisionManager's calibration is (re)established.
   */
  setCalibration(pixelsPerMm: number): void {
    this.pixelsPerMm = pixelsPerMm;
  }

  /**
   * Add a new bar position and check for rep completion.
   * Returns rep data if a rep was completed, null otherwise.
   */
  addPosition(position: BarPosition): RepDetectionResult | null {
    this.positions.push(position);

    // Keep only recent history
    if (this.positions.length > 600) {
      this.positions = this.positions.slice(-600);
    }

    return this.analyze();
  }

  /**
   * Get the current rep count.
   */
  getRepCount(): number {
    return this.repCount;
  }

  /**
   * Get the current phase.
   */
  getPhase(): RepPhase {
    return this.phase;
  }

  /**
   * Reset the detector state.
   */
  reset(): void {
    this.positions = [];
    this.phase = 'idle';
    this.repCount = 0;
    this.currentRepStart = 0;
    this.directionChanges = 0;
    this.framesStill = 0;
    this.peakY = 0;
    this.valleyY = 0;
    this.concentricStart = 0;
  }

  // --- Private analysis ---

  private analyze(): RepDetectionResult | null {
    const n = this.positions.length;
    if (n < 3) return null;

    const current = this.positions[n - 1];
    const prev = this.positions[n - 2];

    // Determine current direction
    const dy = current.y - prev.y;
    const absDy = Math.abs(dy);

    if (absDy < this.directionThreshold) {
      this.framesStill++;
      if (this.framesStill > this.restThreshold && this.phase !== 'idle') {
        // Bar has been still -- check if we completed a rep
        return this.checkRepCompletion();
      }
      return null;
    }

    this.framesStill = 0;
    const direction: 'up' | 'down' = dy < 0 ? 'up' : 'down';

    // Track peak and valley. In image coords Y grows downward, so the TOP of
    // the lift is the smallest Y (peak) and the BOTTOM is the largest (valley).
    // peakY/valleyY are anchored to the rep's actual start position (not 0),
    // so repDistance reflects the true movement amplitude, not the distance
    // from the top edge of the frame.
    if (direction === 'down') {
      this.valleyY = Math.max(this.valleyY, current.y);
    } else {
      this.peakY = Math.min(this.peakY, current.y);
    }

    // Phase machine keyed on current direction of travel, NOT on a remembered
    // lastDirection. This matters for the FIRST rep of a set: if the bar
    // leaves rest by moving down, we must open the eccentric phase even when
    // there is no prior direction to compare against. Driven purely by the
    // reversal geometry (going down -> up -> down), so a lone jittering sample
    // cannot wedge the phase machine.
    if (this.phase === 'idle' && direction === 'down') {
      // Starting eccentric phase — anchor peak/valley to the start position
      this.phase = 'eccentric';
      this.currentRepStart = n - 1;
      this.peakY = current.y;
      this.valleyY = current.y;
      this.directionChanges++;
    } else if (this.phase === 'eccentric' && direction === 'up') {
      // Transition to concentric — record where the lift begins
      this.phase = 'concentric';
      this.concentricStart = n - 1;
      this.directionChanges++;
    } else if (this.phase === 'concentric' && direction === 'down') {
      // Completed a rep (concentric -> eccentric transition means we went up then down)
      // The rep is finalized when the bar settles at rest (restThreshold),
      // which checkRepCompletion handles.
      this.directionChanges++;
    }

    return null;
  }

  /**
   * Check if a rep was completed (bar returned to rest after movement).
   */
  private checkRepCompletion(): RepDetectionResult | null {
    if (this.phase === 'idle') return null;

    const repDistancePx = Math.abs(this.valleyY - this.peakY);
    // Convert to real-world mm when calibration is known. When not calibrated
    // (pixelsPerMm <= 0) fall back to treating pixels as mm so the gate still
    // works during an uncalibrated session (and in isolation for tests).
    const repDistanceMm = this.pixelsPerMm > 0
      ? repDistancePx / this.pixelsPerMm
      : repDistancePx;

    if (repDistanceMm < this.minRepDistanceMm) {
      // Movement too small -- not a rep
      this.phase = 'idle';
      this.directionChanges = 0;
      return null;
    }

    // Valid rep completed
    this.repCount++;
    const repPositions = this.positions.slice(this.currentRepStart);

    // Phase-aware velocity stats: computed over the CONCENTRIC phase only.
    // Concentric velocity is signed negative in this convention (bar moving
    // up = decreasing Y), so take |.| to get physical magnitudes. If no
    // concentric phase was recorded (guard against degenerate reps), fall
    // back to the whole rep window so we never emit a NaN/0-only result.
    const concStart = this.concentricStart > this.currentRepStart
      ? this.concentricStart
      : this.currentRepStart;
    const concPositions = this.positions.slice(concStart);

    const concVelocities = concPositions
      .map(p => Math.abs(p.velocity))
      .filter(v => v > 0);
    const meanConcentricVelocity = concVelocities.length > 0
      ? concVelocities.reduce((a, b) => a + b, 0) / concVelocities.length
      : 0;
    const peakConcentricVelocity = concVelocities.length > 0
      ? Math.max(...concVelocities)
      : 0;

    const result: RepDetectionResult = {
      repNumber: this.repCount,
      startFrame: this.currentRepStart,
      endFrame: this.positions.length - 1,
      distance: repDistanceMm,
      phase: this.phase,
      positions: repPositions,
      meanConcentricVelocity,
      peakConcentricVelocity,
    };

    // Reset for next rep
    this.phase = 'idle';
    this.directionChanges = 0;
    this.peakY = 0;
    this.valleyY = 0;
    this.concentricStart = 0;

    return result;
  }
}

/** Result of a detected rep */
export interface RepDetectionResult {
  repNumber: number;
  startFrame: number;
  endFrame: number;
  /** Rep amplitude in real-world millimeters (or pixels when uncalibrated). */
  distance: number;
  phase: RepPhase;
  positions: BarPosition[];
  /**
   * Mean concentric velocity (m/s) computed over the CONCENTRIC phase only.
   * This is the standard VBT metric. 0 when no valid concentric readings.
   */
  meanConcentricVelocity: number;
  /**
   * Peak concentric velocity (m/s) over the CONCENTRIC phase only.
   * 0 when no valid concentric readings.
   */
  peakConcentricVelocity: number;
}
