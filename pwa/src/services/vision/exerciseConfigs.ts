// src/services/vision/exerciseConfigs.ts

/**
 * Exercise-specific configuration for the vision pipeline.
 *
 * Different exercises require different:
 * - Camera placement (side view for squat, front angle for bench)
 * - Rep detection thresholds (deeper squat vs short bench ROM)
 * - Velocity targets (squat is slower than deadlift)
 * - Tracking axis (Y for squat/deadlift, Y for bench but camera is different)
 * - Phase identification (what counts as "bottom" of a rep)
 */

export type ExerciseCategory = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'clean' | 'snatch' | 'row' | 'custom';
export type CameraPlacement = 'side-sagittal' | 'front-coronal' | 'rear-sagittal' | 'overhead' | '45-degree';

export interface ExerciseVisionConfig {
  /** Exercise category */
  category: ExerciseCategory;
  /** Human-readable name */
  label: string;
  /** Where to place the camera relative to the lifter */
  cameraPlacement: CameraPlacement;
  /** Camera placement instructions for the user */
  placementInstructions: string[];
  /** Which axis to track for rep detection. 'y' = vertical (squat/deadlift), 'x' = horizontal (rare) */
  trackingAxis: 'x' | 'y';
  /** Direction of concentric phase on tracking axis.
   *  'negative' = bar moves up (Y decreases on screen for squat/deadlift/bench)
   *  'positive' = bar moves down (unusual, maybe specific rehab exercises)
   */
  concentricDirection: 'negative' | 'positive';
  /** Minimum pixel displacement to count as a rep */
  minRepDisplacement: number;
  /** Minimum frame duration for a rep (filters out noise/jerks) */
  minRepDurationFrames: number;
  /** Default target velocity in m/s */
  defaultTargetVelocity: number;
  /** Default velocity zone tolerance in m/s */
  defaultTolerance: number;
  /** Typical velocity range for this exercise [min, max] m/s */
  typicalVelocityRange: [number, number];
  /** Default plate diameter for this exercise context */
  defaultPlateDiameterMm: number;
  /** Whether to track bar path (useful for Olympic lifts) */
  trackBarPath: boolean;
  /** Whether to detect squat depth via pose estimation */
  detectDepth: boolean;
  /** Icon for the UI */
  icon: string;
}

/**
 * All built-in exercise configurations.
 */
export const EXERCISE_CONFIGS: Record<ExerciseCategory, ExerciseVisionConfig> = {
  squat: {
    category: 'squat',
    label: 'Squat',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE of the rack',
      'Frame the full range of motion from top to bottom',
      'Barbell plates should be clearly visible',
      'Camera height: roughly at hip level',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 50,
    minRepDurationFrames: 10,
    defaultTargetVelocity: 0.55,
    defaultTolerance: 0.10,
    typicalVelocityRange: [0.30, 1.00],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: true,
    icon: '🦵',
  },

  bench: {
    category: 'bench',
    label: 'Bench Press',
    cameraPlacement: 'front-coronal',
    placementInstructions: [
      'Place camera at the HEAD of the bench, looking down the bar',
      'Camera should be elevated slightly above bench height',
      'The plate end should be clearly visible from this angle',
      'Stable surface is critical -- use a tripod',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 30,
    minRepDurationFrames: 8,
    defaultTargetVelocity: 0.45,
    defaultTolerance: 0.08,
    typicalVelocityRange: [0.15, 0.80],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: false,
    icon: '🛗',
  },

  deadlift: {
    category: 'deadlift',
    label: 'Deadlift',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE of the platform',
      'Frame from floor to full lockout',
      'Camera height: roughly at knee level',
      'Barbell plates should be clearly visible',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 40,
    minRepDurationFrames: 10,
    defaultTargetVelocity: 0.60,
    defaultTolerance: 0.12,
    typicalVelocityRange: [0.30, 1.20],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: false,
    icon: '🏋',
  },

  ohp: {
    category: 'ohp',
    label: 'Overhead Press',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE',
      'Frame from shoulder height to full lockout overhead',
      'Camera height: roughly at shoulder level',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 30,
    minRepDurationFrames: 8,
    defaultTargetVelocity: 0.45,
    defaultTolerance: 0.08,
    typicalVelocityRange: [0.20, 0.90],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: false,
    icon: '💪',
  },

  clean: {
    category: 'clean',
    label: 'Clean',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE of the platform',
      'Frame from floor to front squat catch position',
      'Camera height: roughly at waist level',
      'Fast movement -- ensure good lighting and minimal motion blur',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 40,
    minRepDurationFrames: 5,
    defaultTargetVelocity: 1.20,
    defaultTolerance: 0.20,
    typicalVelocityRange: [0.80, 2.00],
    defaultPlateDiameterMm: 450,
    trackBarPath: true,
    detectDepth: true,
    icon: '⚡',
  },

  snatch: {
    category: 'snatch',
    label: 'Snatch',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE of the platform',
      'Frame from floor to full overhead lockout',
      'Camera height: roughly at waist level',
      'Fastest lift -- ensure high FPS and good lighting',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 40,
    minRepDurationFrames: 4,
    defaultTargetVelocity: 1.40,
    defaultTolerance: 0.25,
    typicalVelocityRange: [1.00, 2.50],
    defaultPlateDiameterMm: 450,
    trackBarPath: true,
    detectDepth: true,
    icon: '🚀',
  },

  row: {
    category: 'row',
    label: 'Barbell Row',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera to the SIDE',
      'Frame from hang position to upper abdomen',
      'Camera height: roughly at waist level',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 25,
    minRepDurationFrames: 6,
    defaultTargetVelocity: 0.50,
    defaultTolerance: 0.10,
    typicalVelocityRange: [0.25, 1.00],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: false,
    icon: '🔄',
  },

  custom: {
    category: 'custom',
    label: 'Custom',
    cameraPlacement: 'side-sagittal',
    placementInstructions: [
      'Place camera where the barbell path is clearly visible',
      'Ensure the plate is in frame throughout the lift',
    ],
    trackingAxis: 'y',
    concentricDirection: 'negative',
    minRepDisplacement: 30,
    minRepDurationFrames: 8,
    defaultTargetVelocity: 0.50,
    defaultTolerance: 0.10,
    typicalVelocityRange: [0.20, 1.50],
    defaultPlateDiameterMm: 450,
    trackBarPath: false,
    detectDepth: false,
    icon: '⚙️',
  },
};

/**
 * Get config for a specific exercise category.
 */
export function getExerciseConfig(category: ExerciseCategory): ExerciseVisionConfig {
  return EXERCISE_CONFIGS[category];
}

/**
 * Get all exercise categories as a selectable list.
 */
export function getExerciseList(): Array<{ category: ExerciseCategory; label: string; icon: string }> {
  return Object.values(EXERCISE_CONFIGS).map(({ category, label, icon }) => ({
    category,
    label,
    icon,
  }));
}

/**
 * Derive VisionConfig overrides from an ExerciseVisionConfig.
 * These adjust the pipeline parameters for the specific exercise.
 */
export function exerciseToVisionOverrides(config: ExerciseVisionConfig): {
  plateDiameterMm?: number;
  movementThreshold?: number;
} {
  return {
    plateDiameterMm: config.defaultPlateDiameterMm,
    movementThreshold: Math.max(2, config.minRepDisplacement / 20),
  };
}
