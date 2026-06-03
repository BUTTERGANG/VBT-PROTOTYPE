// src/services/recording/VideoProcessor.ts

import { VisionManager } from '../vision/VisionManager';
import { DEFAULT_VISION_CONFIG } from '../vision/types';
import type { BarPosition } from '../vision/types';
import type { VelocityReading } from '../../types';

/**
 * Processes a pre-recorded video file through the vision pipeline.
 *
 * Unlike the live camera stream (real-time), VideoProcessor steps through
 * a video frame-by-frame and can run faster than real-time for short clips.
 *
 * Used for:
 * - Processing uploaded videos from the user's gallery
 * - Re-processing recorded videos after calibration changes
 * - Post-hoc analysis with different exercise settings
 */
export class VideoProcessor {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isProcessing = false;
  private cancelled = false;

  async process(
    videoSource: File | Blob | string,
    plateDiameterMm: number,
    onProgress?: (progress: number) => void,
    onVelocityReading?: (reading: VelocityReading) => void,
    onPosition?: (position: BarPosition) => void,
  ): Promise<VideoProcessResult> {
    if (this.isProcessing) {
      throw new Error('Already processing a video');
    }

    this.isProcessing = true;
    this.cancelled = false;

    const readings: VelocityReading[] = [];
    const positions: BarPosition[] = [];
    const startTime = Date.now();

    try {
      // Set up video element
      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;

      const videoUrl = typeof videoSource === 'string'
        ? videoSource
        : URL.createObjectURL(videoSource);

      this.video.src = videoUrl;
      await new Promise<void>((resolve, reject) => {
        this.video!.onloadeddata = () => resolve();
        this.video!.onerror = () => reject(new Error('Failed to load video'));
        this.video!.load();
      });

      const duration = this.video.duration;
      const videoWidth = this.video.videoWidth;
      const videoHeight = this.video.videoHeight;

      // Set up canvas for frame extraction
      this.canvas = document.createElement('canvas');
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (!this.ctx) throw new Error('Could not create canvas context');

      // Initialize vision pipeline (models only, no camera)
      const vm = VisionManager.getInstance({
        ...DEFAULT_VISION_CONFIG,
        plateDiameterMm,
      });

      // Ensure models are loaded
      const detector = vm.getBarbellDetector();
      const calculator = vm.getVelocityCalculator();

      // Auto-calibrate from first frame that detects a plate
      let calibrated = false;

      // Process frame by frame at target FPS
      const fps = 30;
      const totalFrames = Math.floor(duration * fps);
      let repCount = 0;
      let prevDirection: 'up' | 'down' | null = null;

      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelled) break;

        const currentTime = frame / fps;
        this.video.currentTime = currentTime;

        // Wait for seek
        await new Promise<void>((resolve) => {
          this.video!.onseeked = () => resolve();
        });

        // Draw frame to canvas
        this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

        // Run barbell detection on this frame
        const barbell = await detector.detect(this.canvas);

        // Auto-calibrate from first good detection
        if (!calibrated && barbell && barbell.confidence > 0.5) {
          const plateWidth = Math.max(barbell.width, barbell.height);
          vm.calibrateFromDetection(plateWidth);
          calibrated = true;
        }

        // Calculate velocity if calibrated
        if (calibrated && barbell) {
          const position = calculator.processDetection(
            barbell.centerX,
            barbell.centerY,
            Date.now()
          );

          if (position) {
            positions.push(position);
            onPosition?.(position);

            const reading: VelocityReading = {
              timestamp: Date.now(),
              velocity: Math.abs(position.velocity),
              source: 'camera',
            };
            readings.push(reading);
            onVelocityReading?.(reading);

            // Rep counting from direction changes
            if (positions.length >= 3) {
              const last = positions[positions.length - 1];
              const prev = positions[positions.length - 3];
              const dy = last.y - prev.y;
              if (Math.abs(dy) > 5) {
                const dir = dy < 0 ? 'up' : 'down';
                if (prevDirection === 'down' && dir === 'up') {
                  repCount++;
                }
                prevDirection = dir;
              }
            }
          }
        }

        onProgress?.(frame / totalFrames);
      }

      // Cleanup object URL if we created one
      if (typeof videoSource !== 'string') {
        URL.revokeObjectURL(videoUrl);
      }

      return {
        readings,
        positions,
        duration: duration * 1000,
        repCount,
        fps,
        videoWidth,
        videoHeight,
        calibrated,
        processingTimeMs: Date.now() - startTime,
      };

    } finally {
      this.isProcessing = false;
      this.video = null;
      this.canvas = null;
      this.ctx = null;
    }
  }

  cancel(): void {
    this.cancelled = true;
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }
}

export interface VideoProcessResult {
  readings: VelocityReading[];
  positions: BarPosition[];
  duration: number;
  repCount: number;
  fps: number;
  videoWidth: number;
  videoHeight: number;
  calibrated: boolean;
  processingTimeMs: number;
}
