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
 */
export class RepDetector {
  private positions: BarPosition[] = [];
  private phase: RepPhase = 'idle';
  private repCount = 0;
  private currentRepStart = 0;

  // Thresholds
  private minRepDistance: number; // Minimum pixel distance for a valid rep
  private directionThreshold: number; // Minimum velocity to consider movement
  private restThreshold: number; // Frames of stillness to consider "at rest"

  // State tracking
  private lastDirection: 'up' | 'down' | 'none' = 'none';
  private directionChanges = 0;
  private framesStill = 0;
  private peakY = 0;
  private valleyY = 0;

  constructor(options?: {
    minRepDistance?: number;
    directionThreshold?: number;
    restThreshold?: number;
  }) {
    this.minRepDistance = options?.minRepDistance ?? 50;
    this.directionThreshold = options?.directionThreshold ?? 0.02;
    this.restThreshold = options?.restThreshold ?? 15;
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
    this.lastDirection = 'none';
    this.directionChanges = 0;
    this.framesStill = 0;
    this.peakY = 0;
    this.valleyY = 0;
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

    // Track peak and valley
    if (direction === 'down') {
      this.valleyY = Math.max(this.valleyY, current.y);
    } else {
      this.peakY = Math.min(this.peakY, current.y);
    }

    // Detect direction change
    if (this.lastDirection !== 'none' && direction !== this.lastDirection) {
      this.directionChanges++;

      if (this.phase === 'idle' && direction === 'down') {
        // Starting eccentric phase
        this.phase = 'eccentric';
        this.currentRepStart = n - 1;
      } else if (this.phase === 'eccentric' && direction === 'up') {
        // Transition to concentric
        this.phase = 'concentric';
      } else if (this.phase === 'concentric' && direction === 'down') {
        // Completed a rep (concentric -> eccentric transition means we went up then down)
        // Actually, concentric ends when we start going down again
      }
    }

    this.lastDirection = direction;
    return null;
  }

  /**
   * Check if a rep was completed (bar returned to rest after movement).
   */
  private checkRepCompletion(): RepDetectionResult | null {
    if (this.phase === 'idle') return null;

    const repDistance = Math.abs(this.valleyY - this.peakY);

    if (repDistance < this.minRepDistance) {
      // Movement too small -- not a rep
      this.phase = 'idle';
      this.directionChanges = 0;
      return null;
    }

    // Valid rep completed
    this.repCount++;
    const repPositions = this.positions.slice(this.currentRepStart);

    const result: RepDetectionResult = {
      repNumber: this.repCount,
      startFrame: this.currentRepStart,
      endFrame: this.positions.length - 1,
      distance: repDistance,
      phase: this.phase,
      positions: repPositions,
    };

    // Reset for next rep
    this.phase = 'idle';
    this.directionChanges = 0;
    this.peakY = 0;
    this.valleyY = 0;

    return result;
  }
}

/** Result of a detected rep */
export interface RepDetectionResult {
  repNumber: number;
  startFrame: number;
  endFrame: number;
  distance: number; // Pixel distance
  phase: RepPhase;
  positions: BarPosition[];
}
