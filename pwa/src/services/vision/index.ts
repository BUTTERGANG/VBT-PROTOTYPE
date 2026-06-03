// src/services/vision/index.ts

export { VisionManager } from './VisionManager';
export { PoseEstimator } from './PoseEstimator';
export { BarbellDetector } from './BarbellDetector';
export { VelocityCalculator } from './VelocityCalculator';
export { RepDetector } from './RepDetector';
export type {
  BarbellDetection,
  PoseLandmarks,
  FrameAnalysis,
  CalibrationData,
  BarPosition,
  RepPhase,
  VisionState,
  VisionError,
  VisionErrorType,
  VisionConfig,
} from './types';
export { DEFAULT_VISION_CONFIG } from './types';

// Re-export rep detection result type
export type { RepDetectionResult } from './RepDetector';
