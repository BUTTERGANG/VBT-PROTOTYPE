// src/services/vision/PoseEstimator.ts

import {
  PoseLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { PoseLandmarks } from './types';

/**
 * Wraps MediaPipe PoseLandmarker for real-time body pose estimation.
 * Provides body landmark positions used for rep phase detection and
 * distinguishing unracking from working reps.
 */
export class PoseEstimator {
  private poseLandmarker: PoseLandmarker | null = null;
  private lastLandmarks: PoseLandmarks | null = null;

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  /**
   * Estimate pose from a video frame.
   * Returns normalized landmarks (0-1 range) or null if no pose detected.
   */
  async estimate(video: HTMLVideoElement): Promise<PoseLandmarks | null> {
    if (!this.poseLandmarker) return null;

    try {
      const results = this.poseLandmarker.detectForVideo(video, performance.now());

      if (!results.landmarks || results.landmarks.length === 0) {
        return this.lastLandmarks; // Return last known pose for continuity
      }

      const landmarks = results.landmarks[0].map((lm: { x: number; y: number; z: number; visibility?: number }) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
      }));

      this.lastLandmarks = { landmarks };
      return this.lastLandmarks;
    } catch {
      return this.lastLandmarks;
    }
  }

  /**
   * Get the last known landmarks without running detection.
   */
  getLastLandmarks(): PoseLandmarks | null {
    return this.lastLandmarks;
  }

  /**
   * Get a specific landmark by index.
   * Useful for tracking specific body parts (e.g., hip, shoulder).
   */
  getLandmark(landmarks: PoseLandmarks, index: number) {
    return landmarks.landmarks[index] ?? null;
  }

  /**
   * Calculate the vertical position of the hip center.
   * Used for squat depth detection.
   * Hip landmarks: 23 (left), 24 (right)
   */
  getHipCenterY(landmarks: PoseLandmarks): number | null {
    const leftHip = this.getLandmark(landmarks, 23);
    const rightHip = this.getLandmark(landmarks, 24);
    if (!leftHip || !rightHip) return null;
    if (leftHip.visibility < 0.5 || rightHip.visibility < 0.5) return null;
    return (leftHip.y + rightHip.y) / 2;
  }

  /**
   * Calculate the vertical position of the shoulder center.
   * Shoulder landmarks: 11 (left), 12 (right)
   */
  getShoulderCenterY(landmarks: PoseLandmarks): number | null {
    const leftShoulder = this.getLandmark(landmarks, 11);
    const rightShoulder = this.getLandmark(landmarks, 12);
    if (!leftShoulder || !rightShoulder) return null;
    if (leftShoulder.visibility < 0.5 || rightShoulder.visibility < 0.5) return null;
    return (leftShoulder.y + rightShoulder.y) / 2;
  }

  /**
   * Estimate if the lifter is in the bottom position of a squat.
   * Returns true if hip is below knee level.
   */
  isBottomPosition(landmarks: PoseLandmarks): boolean {
    const hipY = this.getHipCenterY(landmarks);
    const leftKnee = this.getLandmark(landmarks, 25);
    const rightKnee = this.getLandmark(landmarks, 26);

    if (hipY === null || !leftKnee || !rightKnee) return false;

    const kneeY = (leftKnee.y + rightKnee.y) / 2;
    // In image coordinates, lower Y = higher on screen
    // Hip below knee means hipY > kneeY
    return hipY > kneeY + 0.02; // Small threshold
  }

  async dispose(): Promise<void> {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.lastLandmarks = null;
  }
}
