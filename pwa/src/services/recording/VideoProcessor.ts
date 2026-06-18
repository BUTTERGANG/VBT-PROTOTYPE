// src/services/recording/VideoProcessor.ts

import { BarbellDetector } from '../vision/BarbellDetector';
import type { BarPosition } from '../vision/types';
import type { VelocityReading, Rep, ZoneResult } from '../../types';

/**
 * Exercise-specific configuration for video processing.
 * Thresholds derived from research:
 *   - Grossi 2026: 1-RM bench press MV ≈ 0.12-0.20 m/s
 *   - Šagovac 2024: submaximal bench MV range ≈ 0.3-1.0 m/s
 *   - Sánchez-Medina 2011: velocity loss zones for fatigue detection
 */
export interface ExerciseConfig {
  name: string;
  /** Minimum rep range in pixels (depends on camera distance and exercise ROM) */
  minRepPixels: number;
  /** Dead zone in px — movements smaller than this are noise */
  deadZone: number;
  /** Minimum eccentric duration in ms (rejects walkout adjustments) */
  minEccentricMs: number;
  /** Maximum physically plausible velocity in m/s for this exercise */
  maxVelocityMs: number;
  /** Velocity zone boundaries for zone classification (m/s) */
  zoneBoundaries: { fast: number; slow: number };
}

const DEFAULT_EXERCISE_CONFIGS: Record<string, ExerciseConfig> = {
  bench: {
    name: 'Bench Press',
    minRepPixels: 60,
    deadZone: 5,
    minEccentricMs: 800,
    maxVelocityMs: 2.5,
    zoneBoundaries: { fast: 0.85, slow: 0.30 },
  },
  squat: {
    name: 'Squat',
    minRepPixels: 80,
    deadZone: 8,
    minEccentricMs: 1000,
    maxVelocityMs: 2.5,
    zoneBoundaries: { fast: 0.90, slow: 0.35 },
  },
  deadlift: {
    name: 'Deadlift',
    minRepPixels: 70,
    deadZone: 6,
    minEccentricMs: 900,
    maxVelocityMs: 2.5,
    zoneBoundaries: { fast: 0.80, slow: 0.25 },
  },
  clean: {
    name: 'Clean',
    minRepPixels: 80,
    deadZone: 8,
    minEccentricMs: 600,
    maxVelocityMs: 3.0,
    zoneBoundaries: { fast: 1.20, slow: 0.50 },
  },
};

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
    exercise: string = 'bench',
  ): Promise<VideoProcessResult> {
    if (this.isProcessing) throw new Error('Already processing a video');

    this.isProcessing = true;
    this.cancelled = false;

    const readings: VelocityReading[] = [];
    const positions: BarPosition[] = [];
    const reps: Rep[] = [];
    const startTime = Date.now();

    // Exercise-specific config
    const exerciseConfig = DEFAULT_EXERCISE_CONFIGS[exercise] ?? DEFAULT_EXERCISE_CONFIGS.bench;

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
      // Collect multiple samples before committing. Using the median of
      // CALIBRATION_SAMPLES rejects a single bad frame from corrupting scale.
      const CALIBRATION_SAMPLES = 10;
      const MIN_PLATE_FRACTION = 0.05;
      const plateWidthSamples: number[] = [];
      let calibrated = false;
      let pixelsPerMm = 0;

      // ── Position smoothing (rolling median) ──────────────────────────────
      // A 9-frame median tolerates up to 4 consecutive bad detections without
      // contaminating the position estimate.
      const rawXBuf: number[] = [];
      const rawYBuf: number[] = [];
      const POS_MEDIAN_WINDOW = 9;

      function medianOf(arr: number[]): number {
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      }

      // ── Velocity (Y-only, signed, window average) ───────────────────────
      // Barbell exercises are primarily vertical. Using only Y displacement
      // eliminates horizontal noise. Signed velocity preserves direction
      // (positive = bar moving down in image coords = eccentric for most lifts).
      const velBuf: Array<{ y: number; ts: number }> = [];
      const VEL_WINDOW = 8;

      // ── Outlier rejection for velocity ───────────────────────────────────
      // Track recent valid velocities to detect and reject spikes.
      const validVelocities: number[] = [];
      const OUTLIER_WINDOW = 15;
      const OUTLIER_THRESHOLD = 3.0; // standard deviations

      function isVelocityOutlier(v: number): boolean {
        if (validVelocities.length < 5) return false;
        const mean = validVelocities.reduce((a, b) => a + b, 0) / validVelocities.length;
        const variance = validVelocities.reduce((a, b) => a + (b - mean) ** 2, 0) / validVelocities.length;
        const std = Math.sqrt(variance);
        if (std < 0.01) return Math.abs(v - mean) > 0.1; // near-zero variance: use absolute
        return Math.abs(v - mean) > OUTLIER_THRESHOLD * std;
      }

      // ── Rep detection (range-based state machine) ────────────────────────
      //
      // Uses RANGE (peak-to-trough) not accumulated travel to avoid false
      // reps from jitter. Research-backed thresholds:
      //   - MIN_REP_PIXELS: must be large enough that noise (±4px) can't trigger
      //   - DEAD_ZONE: minimum direction change to count as phase transition
      //   - MIN_ECCERIC_MS: walkout adjustments complete in <0.5s (Grossi 2026)
      //
      // State machine:
      //   WATCHING  → ECCENTRIC  when bar drops > DEAD_ZONE from highest Y
      //   ECCENTRIC → CONCENTRIC when bar has dropped ≥ MIN_REP_PIXELS AND
      //                           starts rising (> DEAD_ZONE above trough) AND
      //                           minimum eccentric duration met
      //   CONCENTRIC → WATCHING  when bar has risen ≥ MIN_REP_PIXELS from trough
      //                           (rep counted)
      //   CONCENTRIC → ECCENTRIC if bar drops again before rep completes
      //                           (handles pauses / bounce resets)

      const MIN_REP_PIXELS = exerciseConfig.minRepPixels;
      const DEAD_ZONE = exerciseConfig.deadZone;
      const MIN_ECCENTRIC_MS = exerciseConfig.minEccentricMs;
      const MAX_VELOCITY_MS = exerciseConfig.maxVelocityMs;

      type RepPhase = 'watching' | 'eccentric' | 'concentric';
      let repPhase: RepPhase = 'watching';
      let barTopY = 0;    // minimum Y seen (bar physically highest)
      let barBottomY = 0; // maximum Y seen during eccentric (bar physically lowest)
      let eccentricStartTs = 0;
      let firstPos = true;
      let currentRepReadings: VelocityReading[] = [];
      let currentRepPeakVelocity = 0;
      let repNumber = 0;

      // ── Main frame loop ──────────────────────────────────────────────────
      const fps = 30;
      const totalFrames = Math.floor(duration * fps);

      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelled) break;

        const currentTime = frame / fps;
        const frameTs = currentTime * 1000;

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

        if (rawXBuf.length < 3) { onProgress?.(frame / totalFrames); continue; }

        const smoothX = medianOf(rawXBuf);
        const smoothY = medianOf(rawYBuf);

        // Velocity from vertical displacement only (signed)
        velBuf.push({ y: smoothY, ts: frameTs });
        if (velBuf.length > VEL_WINDOW) velBuf.shift();

        let velocity = 0;
        if (velBuf.length >= 3 && pixelsPerMm > 0) {
          const oldest = velBuf[0];
          const newest = velBuf[velBuf.length - 1];
          const dt = (newest.ts - oldest.ts) / 1000;
          if (dt > 0) {
            // Signed velocity: positive = bar moving down (image Y increases)
            const dyPx = newest.y - oldest.y;
            velocity = (dyPx / pixelsPerMm) / 1000 / dt;
          }
        }

        // Reject physically impossible readings
        if (Math.abs(velocity) > MAX_VELOCITY_MS) {
          onProgress?.(frame / totalFrames);
          continue;
        }

        // Outlier rejection using recent velocity history
        if (isVelocityOutlier(velocity)) {
          onProgress?.(frame / totalFrames);
          continue;
        }

        // Track valid velocities for outlier detection
        validVelocities.push(velocity);
        if (validVelocities.length > OUTLIER_WINDOW) validVelocities.shift();

        const position: BarPosition = { x: smoothX, y: smoothY, velocity, isValid: true, timestamp: frameTs };
        positions.push(position);
        onPosition?.(position);

        const reading: VelocityReading = { timestamp: frameTs, velocity, source: 'camera' };
        readings.push(reading);
        currentRepReadings.push(reading);

        // Track peak velocity for this rep (research: PV is most robust metric)
        const absVelocity = Math.abs(velocity);
        if (absVelocity > currentRepPeakVelocity) {
          currentRepPeakVelocity = absVelocity;
        }

        onVelocityReading?.(reading);

        // ── Rep detection state machine ─────────────────────────────────────
        if (firstPos) { barTopY = smoothY; barBottomY = smoothY; firstPos = false; }

        switch (repPhase) {
          case 'watching': {
            if (smoothY < barTopY) barTopY = smoothY;
            barBottomY = smoothY;
            if (smoothY - barTopY > DEAD_ZONE) {
              repPhase = 'eccentric';
              eccentricStartTs = frameTs;
              barBottomY = smoothY;
            }
            break;
          }
          case 'eccentric': {
            if (smoothY > barBottomY) barBottomY = smoothY;
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
            const riseIsValid = rise <= eccRange * 1.4;
            if (rise >= MIN_REP_PIXELS && riseIsValid) {
              // Rep complete
              repNumber++;
              const repVels = currentRepReadings.map(r => Math.abs(r.velocity));
              const mean = repVels.length ? repVels.reduce((a, b) => a + b, 0) / repVels.length : 0;
              const { fast, slow } = exerciseConfig.zoneBoundaries;
              const zone: ZoneResult = mean > fast ? 'FAST' : mean > slow ? 'IN_RANGE' : 'SLOW';
              reps.push({
                repNumber,
                meanVelocity: mean,
                peakVelocity: currentRepPeakVelocity,
                zoneResult: zone,
                readings: [...currentRepReadings],
              });
              repPhase = 'watching';
              barTopY = smoothY;
              barBottomY = smoothY;
              currentRepReadings = [];
              currentRepPeakVelocity = 0;
            } else if (rise >= MIN_REP_PIXELS && !riseIsValid) {
              // Bar overshot — walkout/re-rack, not a real rep
              repPhase = 'watching';
              barTopY = smoothY;
              barBottomY = smoothY;
              currentRepReadings = [];
              currentRepPeakVelocity = 0;
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
