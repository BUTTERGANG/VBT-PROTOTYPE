// src/services/recording/VideoProcessor.ts

import { BarbellDetector } from '../vision/BarbellDetector';
import type { BarPosition } from '../vision/types';
import type { VelocityReading, Rep, ZoneResult } from '../../types';

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
    if (this.isProcessing) throw new Error('Already processing a video');

    this.isProcessing = true;
    this.cancelled = false;

    const readings: VelocityReading[] = [];
    const positions: BarPosition[] = [];
    const reps: Rep[] = [];
    const startTime = Date.now();

    try {
      // ── Video element setup ──────────────────────────────────────────────
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

      this.canvas = document.createElement('canvas');
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (!this.ctx) throw new Error('Could not create canvas context');

      // ── Detection ────────────────────────────────────────────────────────
      const detector = new BarbellDetector(0.5);

      // ── Calibration ──────────────────────────────────────────────────────
      // Collect multiple samples before committing.  Using the median of
      // CALIBRATION_SAMPLES rejects a single bad frame from corrupting scale.
      // MIN_PLATE_FRACTION: plate must be ≥5% of frame width — anything smaller
      // is almost certainly not an Olympic plate at normal filming distance.
      const CALIBRATION_SAMPLES = 10;
      const MIN_PLATE_FRACTION = 0.05;
      const plateWidthSamples: number[] = [];
      let calibrated = false;
      let pixelsPerMm = 0;

      // ── Position smoothing (rolling median) ──────────────────────────────
      // A 9-frame median tolerates up to 4 consecutive bad detections without
      // contaminating the position estimate.  Outlier frames (detector jumped
      // to a different object) are simply rejected by the median.
      const rawXBuf: number[] = [];
      const rawYBuf: number[] = [];
      const POS_MEDIAN_WINDOW = 9;

      function medianOf(arr: number[]): number {
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      }

      // ── Velocity (Y-only, window average) ───────────────────────────────
      // Barbell exercises are primarily vertical.  Using only Y displacement
      // eliminates horizontal noise that inflated velocities with euclidean
      // distance.  A window average further reduces single-frame jitter.
      const velBuf: Array<{ y: number; ts: number }> = [];
      const VEL_WINDOW = 8; // frames
      const MAX_VELOCITY_MS = 2.5; // physical ceiling — anything higher is a bad detection

      // ── Rep detection (range-based state machine) ────────────────────────
      //
      // Previous accumulator approach was broken: eccentricTravel and
      // concentricTravel both grew with any up/down jitter, so 8 cycles of
      // ±5px noise hit the 40px threshold and registered as a false rep.
      //
      // This state machine uses RANGE (peak-to-trough) not accumulated travel:
      //   WATCHING  → ECCENTRIC  when bar drops > DEAD_ZONE from highest Y
      //   ECCENTRIC → CONCENTRIC when bar has dropped ≥ MIN_REP_PIXELS AND
      //                           starts rising again (> DEAD_ZONE above trough)
      //   CONCENTRIC → WATCHING  when bar has risen ≥ MIN_REP_PIXELS from trough
      //               (rep counted)
      //   CONCENTRIC → ECCENTRIC if bar unexpectedly drops again before rep
      //                           completes (handles pauses / bounce resets)
      //
      // With MIN_REP_PIXELS = 60 and noise ≤ ±4px, noise never triggers a rep.
      const MIN_REP_PIXELS = 60;
      const DEAD_ZONE = 5; // px — ignore movements smaller than this
      // A squat eccentric (descent) always takes ≥ 0.8s.  Walkout stance
      // adjustments complete in < 0.5s and would otherwise trigger a false rep.
      const MIN_ECCENTRIC_MS = 800;

      type RepPhase = 'watching' | 'eccentric' | 'concentric';
      let repPhase: RepPhase = 'watching';
      let barTopY = 0;    // minimum Y seen (bar physically highest)
      let barBottomY = 0; // maximum Y seen during eccentric (bar physically lowest)
      let eccentricStartTs = 0;
      let firstPos = true;
      let currentRepReadings: VelocityReading[] = [];
      let repNumber = 0;

      // ── Main frame loop ──────────────────────────────────────────────────
      const fps = 30;
      const totalFrames = Math.floor(duration * fps);

      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelled) break;

        const currentTime = frame / fps;
        const frameTs = currentTime * 1000; // ms — gives VelocityCalculator correct dt

        this.video.currentTime = currentTime;
        await new Promise<void>((resolve) => { this.video!.onseeked = () => resolve(); });
        this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);

        const barbell = await detector.detect(this.canvas);

        // Calibration sampling
        if (!calibrated && barbell && barbell.confidence > 0.6) {
          const plateFraction = Math.max(barbell.width, barbell.height) / videoWidth;
          if (plateFraction >= MIN_PLATE_FRACTION) {
            plateWidthSamples.push(Math.max(barbell.width, barbell.height));
            if (plateWidthSamples.length >= CALIBRATION_SAMPLES) {
              const sorted = [...plateWidthSamples].sort((a, b) => a - b);
              const medianWidth = sorted[Math.floor(sorted.length / 2)];
              pixelsPerMm = medianWidth / plateDiameterMm;
              calibrated = true;
            }
          }
        }

        if (!calibrated || !barbell) {
          onProgress?.(frame / totalFrames);
          continue;
        }

        // Accumulate raw detection into median buffer
        rawXBuf.push(barbell.centerX);
        rawYBuf.push(barbell.centerY);
        if (rawXBuf.length > POS_MEDIAN_WINDOW) { rawXBuf.shift(); rawYBuf.shift(); }

        // Need a few frames before the median is meaningful
        if (rawXBuf.length < 3) { onProgress?.(frame / totalFrames); continue; }

        const smoothX = medianOf(rawXBuf);
        const smoothY = medianOf(rawYBuf);

        // Velocity from vertical displacement only
        velBuf.push({ y: smoothY, ts: frameTs });
        if (velBuf.length > VEL_WINDOW) velBuf.shift();

        let velocity = 0;
        if (velBuf.length >= 3 && pixelsPerMm > 0) {
          const oldest = velBuf[0];
          const newest = velBuf[velBuf.length - 1];
          const dt = (newest.ts - oldest.ts) / 1000;
          if (dt > 0) {
            const dyPx = Math.abs(newest.y - oldest.y);
            velocity = (dyPx / pixelsPerMm) / 1000 / dt;
          }
        }

        // Reject physically impossible readings — these are always detection jumps
        if (velocity > MAX_VELOCITY_MS) { onProgress?.(frame / totalFrames); continue; }

        const position: BarPosition = { x: smoothX, y: smoothY, velocity, isValid: true, timestamp: frameTs };
        positions.push(position);
        onPosition?.(position);

        const reading: VelocityReading = { timestamp: frameTs, velocity, source: 'camera' };
        readings.push(reading);
        currentRepReadings.push(reading);
        onVelocityReading?.(reading);

        // Rep detection state machine
        if (firstPos) { barTopY = smoothY; barBottomY = smoothY; firstPos = false; }

        switch (repPhase) {
          case 'watching': {
            // Track the highest physical position (lowest Y value in image coords)
            if (smoothY < barTopY) barTopY = smoothY;
            barBottomY = smoothY;
            // Transition: bar has dropped enough from its peak
            if (smoothY - barTopY > DEAD_ZONE) {
              repPhase = 'eccentric';
              eccentricStartTs = frameTs;
              barBottomY = smoothY;
            }
            break;
          }
          case 'eccentric': {
            // Track the trough
            if (smoothY > barBottomY) barBottomY = smoothY;
            // Transition: enough range AND bar has started rising AND minimum duration met.
            // The duration guard (≥800ms) rejects walkout stance adjustments which
            // complete in <0.5s but produce enough pixel range to pass the pixel check.
            if ((barBottomY - barTopY) >= MIN_REP_PIXELS
                && smoothY < barBottomY - DEAD_ZONE
                && (frameTs - eccentricStartTs) >= MIN_ECCENTRIC_MS) {
              repPhase = 'concentric';
            }
            break;
          }
          case 'concentric': {
            const rise = barBottomY - smoothY;
            const eccRange = barBottomY - barTopY;
            // A real rep returns to approximately where it started: rise ≤ eccRange × 1.4.
            // A walkout adjustment "returns" to a higher standing position, so its
            // concentric rise exceeds the eccentric descent by a large margin.
            const riseIsValid = rise <= eccRange * 1.4;
            if (rise >= MIN_REP_PIXELS && riseIsValid) {
              // Rep complete
              repNumber++;
              const repVels = currentRepReadings.map(r => r.velocity);
              const mean = repVels.length ? repVels.reduce((a, b) => a + b, 0) / repVels.length : 0;
              const peak = repVels.length ? Math.max(...repVels) : 0;
              const zone: ZoneResult = mean > 0.85 ? 'FAST' : mean > 0.6 ? 'IN_RANGE' : 'SLOW';
              reps.push({ repNumber, meanVelocity: mean, peakVelocity: peak, zoneResult: zone, readings: [...currentRepReadings] });
              repPhase = 'watching';
              barTopY = smoothY;
              barBottomY = smoothY;
              currentRepReadings = [];
            } else if (rise >= MIN_REP_PIXELS && !riseIsValid) {
              // Bar overshot the starting position — walkout/re-rack, not a real rep.
              // Treat the new (higher) position as the real standing baseline.
              repPhase = 'watching';
              barTopY = smoothY;
              barBottomY = smoothY;
              currentRepReadings = [];
            } else if (smoothY > barBottomY + DEAD_ZONE) {
              // Bar dropped again before completing — reset to eccentric
              repPhase = 'eccentric';
            }
            break;
          }
        }

        onProgress?.(frame / totalFrames);
      }

      if (typeof videoSource !== 'string') URL.revokeObjectURL(videoUrl);

      return {
        readings,
        positions,
        reps,
        duration: duration * 1000,
        repCount: reps.length,
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

  cancel(): void { this.cancelled = true; }
  getIsProcessing(): boolean { return this.isProcessing; }
}

export interface VideoProcessResult {
  readings: VelocityReading[];
  positions: BarPosition[];
  reps: Rep[];
  duration: number;
  repCount: number;
  fps: number;
  videoWidth: number;
  videoHeight: number;
  calibrated: boolean;
  processingTimeMs: number;
}
