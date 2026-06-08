// src/services/vision/VisionManager.ts

import type {
  VisionState,
  VisionError,
  VisionConfig,
  FrameAnalysis,
  CalibrationData,
  BarPosition,
} from './types';
import { DEFAULT_VISION_CONFIG } from './types';
import { PoseEstimator } from './PoseEstimator';
import { BarbellDetector } from './BarbellDetector';
import { VelocityCalculator } from './VelocityCalculator';
import { RepDetector } from './RepDetector';
import type { RepDetectionResult } from './RepDetector';

type StateListener = (state: VisionState) => void;
type ErrorListener = (error: VisionError) => void;
type AnalysisListener = (analysis: FrameAnalysis) => void;
type PositionListener = (position: BarPosition) => void;
type RepListener = (rep: RepDetectionResult) => void;

/**
 * VisionManager orchestrates the entire camera-based VBT pipeline:
 * 1. Camera stream acquisition
 * 2. Per-frame barbell detection + pose estimation
 * 3. Scale calibration (plate diameter -> pixels/mm)
 * 4. Velocity calculation from tracked positions
 *
 * Outputs VelocityReading[] compatible with the existing store.
 */
export class VisionManager {
  private static instance: VisionManager;

  private state: VisionState = 'uninitialized';
  private config: VisionConfig;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private frameNumber = 0;
  private lastFrameTime = 0;

  private poseEstimator: PoseEstimator;
  private barbellDetector: BarbellDetector;
  private velocityCalculator: VelocityCalculator;
  private repDetector: RepDetector;
  private calibration: CalibrationData;

  private stateListeners: Set<StateListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private analysisListeners: Set<AnalysisListener> = new Set();
  private positionListeners: Set<PositionListener> = new Set();
  private repListeners: Set<RepListener> = new Set();

  private constructor(config: VisionConfig) {
    this.config = config;
    this.poseEstimator = new PoseEstimator();
    this.barbellDetector = new BarbellDetector(config.minConfidence);
    this.velocityCalculator = new VelocityCalculator(config.smoothingWindow);
    this.repDetector = new RepDetector();
    this.calibration = {
      plateDiameterMm: config.plateDiameterMm,
      pixelsPerMm: 0,
      isCalibrated: false,
    };
  }

  static getInstance(config?: Partial<VisionConfig>): VisionManager {
    if (!VisionManager.instance) {
      VisionManager.instance = new VisionManager({
        ...DEFAULT_VISION_CONFIG,
        ...config,
      });
    }
    return VisionManager.instance;
  }

  // --- Subscription API (mirrors BLEManager pattern) ---

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  subscribeAnalysis(listener: AnalysisListener): () => void {
    this.analysisListeners.add(listener);
    return () => this.analysisListeners.delete(listener);
  }

  subscribePosition(listener: PositionListener): () => void {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
  }

  subscribeRep(listener: RepListener): () => void {
    this.repListeners.add(listener);
    return () => this.repListeners.delete(listener);
  }

  // --- Getters ---

  getState(): VisionState {
    return this.state;
  }

  getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  updateConfig(partial: Partial<VisionConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Expose BarbellDetector for video processing mode.
   * Allows processing individual frames from a pre-recorded video.
   */
  getBarbellDetector(): BarbellDetector {
    return this.barbellDetector;
  }

  /**
   * Expose VelocityCalculator for video processing mode.
   */
  getVelocityCalculator(): VelocityCalculator {
    return this.velocityCalculator;
  }

  // --- Lifecycle ---

  /**
   * Initialize the vision pipeline: load ML models, request camera.
   * Must be called from a user gesture (button click) for camera permission.
   */
  async initialize(videoEl: HTMLVideoElement): Promise<void> {
    try {
      this.setState('initializing');
      this.video = videoEl;

      // Create offscreen canvas for frame processing
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (!this.ctx) throw this.makeError('camera-unavailable', 'Could not create canvas context');

      // Load ML models with an 8-second timeout — camera starts even if
      // CDN is unreachable; barbell detector falls back to contour-based detection
      const modelTimeout = new Promise<void>(resolve => setTimeout(resolve, 8000));
      try {
        await Promise.race([
          Promise.all([
            this.poseEstimator.initialize(),
            this.barbellDetector.initialize(),
          ]),
          modelTimeout,
        ]);
      } catch {
        console.warn('[VisionManager] ML model load failed — using fallback detection');
      }

      // Request camera
      this.setState('requesting-camera');
      await this.startCamera();

      this.setState('camera-ready');
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Set calibration from a detected plate width in pixels.
   * Call this after the user confirms a detection, or auto-detect
   * from the first high-confidence detection.
   */
  calibrateFromDetection(plateWidthPixels: number): void {
    if (plateWidthPixels <= 0) {
      this.notifyError(this.makeError('calibration-failed', 'Invalid plate width for calibration'));
      return;
    }
    this.calibration.pixelsPerMm = plateWidthPixels / this.calibration.plateDiameterMm;
    this.calibration.isCalibrated = true;
    this.velocityCalculator.setCalibration(this.calibration.pixelsPerMm);
    this.setState('calibrated');
  }

  /**
   * Manually set calibration (e.g., from user-measured plate pixel width).
   */
  setCalibration(pixelsPerMm: number): void {
    this.calibration.pixelsPerMm = pixelsPerMm;
    this.calibration.isCalibrated = true;
    this.velocityCalculator.setCalibration(pixelsPerMm);
    this.setState('calibrated');
  }

  /**
   * Start the processing loop. Camera must be ready.
   */
  startTracking(): void {
    if (this.state !== 'camera-ready' && this.state !== 'calibrated') {
      this.notifyError(this.makeError('unknown', 'Cannot start tracking: camera not ready'));
      return;
    }
    this.setState('tracking');
    this.frameNumber = 0;
    this.lastFrameTime = performance.now();
    this.repDetector.reset();
    this.velocityCalculator.reset();
    this.processFrame();
  }

  /**
   * Stop the processing loop.
   */
  stopTracking(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.state === 'tracking') {
      this.setState(this.calibration.isCalibrated ? 'calibrated' : 'camera-ready');
    }
  }

  /**
   * Full shutdown: stop tracking, release camera, clean up.
   */
  async dispose(): Promise<void> {
    this.stopTracking();
    this.stopCamera();
    await this.poseEstimator.dispose();
    await this.barbellDetector.dispose();
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.setState('uninitialized');
  }

  // --- Private: Camera ---

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw this.makeError('camera-unavailable', 'getUserMedia not supported');
    }

    const baseConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };

    if (this.config.deviceId) {
      // Specific camera selected by the user (works on desktop + mobile)
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: this.config.deviceId }, ...baseConstraints },
        audio: false,
      });
    } else {
      // Try rear camera (mobile), fall back to any available camera (desktop)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.config.facingMode, ...baseConstraints },
          audio: false,
        });
      } catch {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: baseConstraints,
          audio: false,
        });
      }
    }

    if (!this.video) throw this.makeError('camera-unavailable', 'Video element not set');

    this.video.srcObject = this.stream;
    await this.video.play();

    // Set canvas size to match video
    if (this.canvas) {
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
    }
  }

  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // --- Private: Processing Loop ---

  private processFrame = async (): Promise<void> => {
    if (!this.video || !this.canvas || !this.ctx) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const frameInterval = 1000 / this.config.targetFps;

    // Throttle to target FPS
    if (elapsed < frameInterval) {
      this.animationFrameId = requestAnimationFrame(this.processFrame);
      return;
    }

    this.lastFrameTime = now;
    this.frameNumber++;

    // Draw current video frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    // Run detection and pose estimation in parallel
    const [barbell, pose] = await Promise.all([
      this.barbellDetector.detect(this.canvas),
      this.poseEstimator.estimate(this.video),
    ]);

    const analysis: FrameAnalysis = {
      timestamp: Date.now(),
      frameNumber: this.frameNumber,
      barbell,
      pose,
    };

    this.notifyAnalysis(analysis);

    // If calibrated and tracking barbell, calculate velocity
    if (this.calibration.isCalibrated && barbell) {
      const position = this.velocityCalculator.processDetection(
        barbell.centerX,
        barbell.centerY,
        analysis.timestamp
      );
      if (position) {
        this.notifyPosition(position);

        // Feed position to rep detector
        const rep = this.repDetector.addPosition(position);
        if (rep) {
          this.notifyRep(rep);
        }
      }
    }

    // Continue loop
    if (this.state === 'tracking') {
      this.animationFrameId = requestAnimationFrame(this.processFrame);
    }
  };

  // --- Private: Notifications ---

  private setState(state: VisionState): void {
    this.state = state;
    this.stateListeners.forEach((l) => l(state));
  }

  private notifyError(error: VisionError): void {
    this.setState('error');
    this.errorListeners.forEach((l) => l(error));
  }

  private notifyAnalysis(analysis: FrameAnalysis): void {
    this.analysisListeners.forEach((l) => l(analysis));
  }

  private notifyPosition(position: BarPosition): void {
    this.positionListeners.forEach((l) => l(position));
  }

  private notifyRep(rep: RepDetectionResult): void {
    this.repListeners.forEach((l) => l(rep));
  }

  // --- Private: Error handling ---

  private handleError(err: unknown): void {
    if (this.isVisionError(err)) {
      this.notifyError(err);
    } else {
      this.notifyError(this.makeError('unknown', err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  private makeError(type: VisionError['type'], message: string): VisionError {
    return { type, message };
  }

  private isVisionError(err: unknown): err is VisionError {
    return typeof err === 'object' && err !== null && 'type' in err && 'message' in err;
  }
}
