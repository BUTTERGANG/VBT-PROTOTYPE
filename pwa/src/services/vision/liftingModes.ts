// src/services/vision/liftingModes.ts

/**
 * VBT Lifting Modes (speed zones).
 *
 * Mode 1 = Strength (slow, heavy)  ~0.30-0.50 m/s
 * Mode 2 = Hypertrophy (moderate)  ~0.50-0.75 m/s
 * Mode 3 = Speed/Power (fast)      ~0.75-1.50 m/s
 *
 * Each mode sets default target velocity and loss threshold.
 * Users can override with the speed slider.
 */

export type LiftingMode = 1 | 2 | 3;

export interface LiftingModeConfig {
  mode: LiftingMode;
  label: string;
  description: string;
  color: string;
  /** Default target velocity in m/s */
  defaultTargetVelocity: number;
  /** Default tolerance in m/s */
  defaultTolerance: number;
  /** Velocity loss threshold (%) - triggers fatigue cue */
  lossThreshold: number;
  /** Typical velocity range [min, max] m/s */
  velocityRange: [number, number];
}

export const LIFTING_MODES: Record<LiftingMode, LiftingModeConfig> = {
  1: {
    mode: 1,
    label: 'Strength',
    description: 'Heavy loads, slow velocity',
    color: '#ef4444', // red
    defaultTargetVelocity: 0.35,
    defaultTolerance: 0.08,
    lossThreshold: 0.20, // 20% velocity drop
    velocityRange: [0.15, 0.50],
  },
  2: {
    mode: 2,
    label: 'Hypertrophy',
    description: 'Moderate loads, moderate velocity',
    color: '#f59e0b', // amber
    defaultTargetVelocity: 0.60,
    defaultTolerance: 0.10,
    lossThreshold: 0.25, // 25% velocity drop
    velocityRange: [0.40, 0.80],
  },
  3: {
    mode: 3,
    label: 'Speed',
    description: 'Light loads, fast velocity',
    color: '#10b981', // green
    defaultTargetVelocity: 1.00,
    defaultTolerance: 0.15,
    lossThreshold: 0.30, // 30% velocity drop
    velocityRange: [0.75, 1.80],
  },
};

export function getLiftingModeConfig(mode: LiftingMode): LiftingModeConfig {
  return LIFTING_MODES[mode];
}
