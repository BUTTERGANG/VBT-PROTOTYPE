// src/services/vision/types.ts

/** A detected barbell endcap in a single frame */
export interface BarbellDetection {
  /** Bounding box of the plate endcap, in pixel coordinates */
  x: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Detection confidence 0-1 */
  confidence: number;
}

/** Pose landmarks from MediaPipe */
export interface PoseLandmarks {
  /** 33 landmarks, each with x, y, z, visibility */
  landmarks: Array<{
    x: number;
    y: number;
    z: number;
    visibility: number;
  }>;
}

/** A single frame's complete analysis output */
export interface FrameAnalysis {
  timestamp: number;
  frameNumber: number;
  barbell: BarbellDetection | null;
  pose: PoseLandmarks | null;
}

/** Calibration data for converting pixels to real-world units */
export interface CalibrationData {
  /** Plate diameter in millimeters (user-provided) */
  plateDiameterMm: number;
  /** Calculated pixels-per-millimeter at the barbell's depth plane */
  pixelsPerMm: number;
  /** Whether calibration has been completed */
  isCalibrated: boolean;
}

/** A tracked bar position over time */
export interface BarPosition {
  timestamp?: number;
  /** X position in pixels */
  x: number;
  /** Y position in pixels */
  y: number;
  /** Velocity in m/s (calculated from displacement) */
  velocity: number;
  /** Whether this frame had a valid detection */
  isValid: boolean;
}

/** Phase of a rep */
export type RepPhase = 'idle' | 'eccentric' | 'concentric';

/** Vision pipeline state */
export type VisionState =
  | 'uninitialized'
  | 'initializing'
  | 'requesting-camera'
  | 'camera-ready'
  | 'calibrating'
  | 'calibrated'
  | 'tracking'
  | 'error';

/** Vision error types */
export type VisionErrorType =
  | 'camera-denied'
  | 'camera-unavailable'
  | 'model-load-failed'
  | 'calibration-failed'
  | 'tracking-lost'
  | 'unknown';

export interface VisionError {
  type: VisionErrorType;
  message: string;
}

/** Configuration for the vision pipeline */
export interface VisionConfig {
  /** Target plate diameter in mm. Default 450 (Olympic bumper) */
  plateDiameterMm: number;
  /** Camera facing mode */
  facingMode: 'environment' | 'user';
  /** Target FPS for processing */
  targetFps: number;
  /** Minimum detection confidence threshold */
  minConfidence: number;
  /** Velocity smoothing window size */
  smoothingWindow: number;
  /** Minimum displacement in pixels to consider movement */
  movementThreshold: number;
  /** Velocity drop threshold for fatigue detection (0-1) */
  fatigueThreshold: number;
}

export const DEFAULT_VISION_CONFIG: VisionConfig = {
  plateDiameterMm: 450,
  facingMode: 'environment',
  targetFps: 30,
  minConfidence: 0.5,
  smoothingWindow: 5,
  movementThreshold: 3,
  fatigueThreshold: 0.2,
};
