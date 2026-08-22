// src/services/vision/BarbellDetector.ts

import * as tf from '@tensorflow/tfjs';
import type { BarbellDetection } from './types';
import { blendBarPosition, wristMidpoint, type PoseLandmarks } from './barFallback';

export const MODEL_URL = '/models/barbell-detector/model.json';

/**
 * Detects barbell endcaps in video frames.
 *
 * Strategy:
 * 1. Primary: YOLO/TFLite model fine-tuned on barbell endcap images
 * 2. Fallback: Contour-based circular shape detector for plate rims
 *
 * Research-backed improvements (2026-06-17):
 * - Tighter spatial continuity threshold (3% vs 5% of frame width) to reject
 *   cross-object jumps. At 1080px width and 30fps, a plate moving at 2 m/s
 *   travels ~67mm/frame ≈ 30px at typical filming distance. 3% of 1080px = 32px
 *   gives tight but physically plausible per-frame tolerance.
 * - Temporal position smoothing: exponential moving average (EMA) with alpha=0.4
 *   rejects single-frame detection jumps without adding the 4-5 frame lag of
 *   a median filter.
 * - Confidence-weighted position blending: high-confidence detections move the
 *   smoothed position more than low-confidence ones.
 */
export class BarbellDetector {
  private model: tf.GraphModel | tf.LayersModel | null = null;
  private minConfidence: number;
  private useFallback: boolean = true;
  private fallbackDetector: ContourPlateDetector;
  /** Set once when the model is found missing — never spam the console */
  private warnedModelMissing = false;

  // Temporal smoothing state
  private smoothedX: number | null = null;
  private smoothedY: number | null = null;
  private readonly EMA_ALPHA = 0.4; // higher = more responsive, less smoothing

  // Interpolation for detection gaps
  private lastDetection: BarbellDetection | null = null;
  private framesSinceDetection = 0;
  private readonly MAX_INTERPOLATION_FRAMES = 5;

  constructor(minConfidence: number = 0.5) {
    this.minConfidence = minConfidence;
    this.fallbackDetector = new ContourPlateDetector(minConfidence);
  }

  async initialize(): Promise<void> {
    try {
      await tf.ready();
      this.model = await tf.loadGraphModel(MODEL_URL);
      this.useFallback = false;
    } catch (err) {
      // Model absence must be explicit and observable — it silently degrades
      // bar-path quality, so the UI needs to surface "heuristic mode".
      this.useFallback = true;
      this.model = null;
      if (!this.warnedModelMissing) {
        this.warnedModelMissing = true;
        console.warn(
          `[BarbellDetector] Trained barbell model not available at ${MODEL_URL} ` +
          `(${err instanceof Error ? err.message : 'load failed'}). ` +
          'Falling back to contour + pose-wrist heuristic detection: expect ' +
          'reduced accuracy. Deploy the model to pwa/public/models/barbell-detector/ ' +
          'to enable model mode.',
        );
      }
    }
  }

  /**
   * Detect the bar position. In heuristic (fallback) mode, `pose` landmarks
   * are used as a confidence-blended alternative signal: the wrist midpoint
   * physically tracks the bar in side-view lifts and rescues frames where the
   * contour detector locks onto the wrong object or misses entirely.
   */
  async detect(canvas: HTMLCanvasElement, pose?: PoseLandmarks | null): Promise<BarbellDetection | null> {
    let detection: BarbellDetection | null = null;

    if (this.useFallback || !this.model) {
      const contourDetection = this.fallbackDetector.detect(canvas);
      if (pose) {
        const hint = wristMidpoint(pose, canvas.width, canvas.height);
        detection = blendBarPosition(contourDetection, hint);
      } else {
        detection = contourDetection;
      }
    } else {
      detection = await this.detectWithModel(canvas);
    }

    if (detection) {
      // Apply temporal smoothing (EMA) to reduce frame-to-frame jitter
      if (this.smoothedX !== null && this.smoothedY !== null) {
        // Confidence-weighted alpha: high confidence = trust detection more
        const alpha = this.EMA_ALPHA * detection.confidence;
        this.smoothedX = this.smoothedX + alpha * (detection.centerX - this.smoothedX);
        this.smoothedY = this.smoothedY + alpha * (detection.centerY - this.smoothedY);
      } else {
        this.smoothedX = detection.centerX;
        this.smoothedY = detection.centerY;
      }

      // Return smoothed position
      detection = {
        ...detection,
        centerX: this.smoothedX,
        centerY: this.smoothedY,
        x: this.smoothedX - detection.width / 2,
      };

      this.lastDetection = detection;
      this.framesSinceDetection = 0;
    } else {
      this.framesSinceDetection++;
      if (this.framesSinceDetection <= this.MAX_INTERPOLATION_FRAMES && this.lastDetection) {
        const decay = 1 - (this.framesSinceDetection / (this.MAX_INTERPOLATION_FRAMES + 1));
        detection = {
          ...this.lastDetection,
          confidence: this.lastDetection.confidence * decay,
        };
      }
    }

    return detection;
  }

  private async detectWithModel(canvas: HTMLCanvasElement): Promise<BarbellDetection | null> {
    if (!this.model) return null;

    const tensor = tf.tidy(() => {
      let img = tf.browser.fromPixels(canvas);
      img = tf.image.resizeBilinear(img as tf.Tensor3D, [416, 416]);
      img = img.expandDims(0).div(255.0);
      return img;
    });

    try {
      const predictions = this.model.predict(tensor) as tf.Tensor;
      const data = await predictions.data();
      const numDetections = predictions.shape[1] ?? 0;
      let best: BarbellDetection | null = null;

      for (let i = 0; i < numDetections; i++) {
        const offset = i * 6;
        const confidence = data[offset + 4];
        if (confidence < this.minConfidence) continue;

        const x = data[offset];
        const y = data[offset + 1];
        const w = data[offset + 2];
        const h = data[offset + 3];

        if (!best || confidence > best.confidence) {
          best = {
            x: x - w / 2,
            centerX: x,
            centerY: y,
            width: w,
            height: h,
            confidence,
          };
        }
      }

      if (best) {
        const scaleX = canvas.width / 416;
        const scaleY = canvas.height / 416;
        best.x *= scaleX;
        best.centerX *= scaleX;
        best.centerY *= scaleY;
        best.width *= scaleX;
        best.height *= scaleY;
      }

      return best;
    } finally {
      tensor.dispose();
    }
  }

  /** Reset smoothing state (call at the start of each new set) */
  reset(): void {
    this.smoothedX = null;
    this.smoothedY = null;
    this.lastDetection = null;
    this.framesSinceDetection = 0;
    this.fallbackDetector.reset();
  }

  setModel(model: tf.GraphModel | tf.LayersModel): void {
    this.model = model;
    this.useFallback = false;
  }

  isUsingModel(): boolean {
    return !this.useFallback;
  }

  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.lastDetection = null;
  }
}

/**
 * Contour-based plate detector.
 *
 * Algorithm:
 * 1. Convert to grayscale
 * 2. Apply Gaussian blur to reduce noise
 * 3. Sobel edge detection
 * 4. Threshold edges
 * 5. Find connected components (flood fill)
 * 6. Score each contour as a potential plate rim based on aspect ratio,
 *    size, circularity, and position
 * 7. Spatial continuity: reject detections that jump too far from the last
 *    accepted position
 */
class ContourPlateDetector {
  private minConfidence: number;

  // Spatial continuity state
  private lastCenterX: number | null = null;
  private lastCenterY: number | null = null;
  // Tighter threshold: 3% of frame width. At 1080px = 32px max jump per frame.
  // A plate at 2 m/s, 30fps, ~0.5px/mm = 33px/frame. This allows real movement
  // while rejecting cross-object jumps (typically 100-300px).
  private readonly MAX_JUMP_FRACTION = 0.03;

  constructor(minConfidence: number) {
    this.minConfidence = minConfidence;
  }

  detect(canvas: HTMLCanvasElement): BarbellDetection | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);

    const gray = this.toGrayscale(imageData.data, w, h);
    const blurred = this.gaussianBlur(gray, w, h);
    const edges = this.sobelEdges(blurred, w, h);

    const edgeThreshold = 30;
    const binary = edges.map(v => v > edgeThreshold ? 1 : 0);

    const contours = this.findComponents(binary, w, h);

    if (contours.length === 0) return null;

    let bestDetection: BarbellDetection | null = null;
    let bestScore = 0;

    for (const contour of contours) {
      const area = contour.pixelCount;
      if (area < 200 || area > (w * h * 0.3)) continue;

      const bbox = contour.bbox;
      const bw = bbox.maxX - bbox.minX;
      const bh = bbox.maxY - bbox.minY;

      if (bw < 30 || bh < 30) continue;

      // Aspect ratio score — plates are roughly circular/elliptical
      const aspectRatio = Math.min(bw, bh) / Math.max(bw, bh);
      if (aspectRatio < 0.3) continue;
      const aspectScore = aspectRatio;

      // Circularity score
      const perimeter = contour.perimeter;
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      const circScore = Math.min(circularity, 1);

      // Size score — plates must be a significant fraction of the frame
      const sizeRatio = bw / w;
      let sizeScore: number;
      if (sizeRatio < 0.03) {
        continue; // Hard reject — too small
      } else if (sizeRatio < 0.05) {
        sizeScore = 0.2;
      } else if (sizeRatio <= 0.45) {
        sizeScore = 1.0;
      } else {
        sizeScore = 0.3;
      }

      // Position score — plates are usually in the middle-lower area
      const centerY = (bbox.minY + bbox.maxY) / 2;
      const posScore = (centerY / h > 0.2 && centerY / h < 0.9) ? 1 : 0.5;

      const score = aspectScore * 0.25 + circScore * 0.25 + sizeScore * 0.35 + posScore * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestDetection = {
          x: bbox.minX,
          centerX: (bbox.minX + bbox.maxX) / 2,
          centerY: (bbox.minY + bbox.maxY) / 2,
          width: bw,
          height: bh,
          confidence: Math.min(score * 1.2, 0.95),
        };
      }
    }

    if (!bestDetection || bestDetection.confidence < this.minConfidence) {
      return null;
    }

    // Spatial continuity check — tighter threshold
    if (this.lastCenterX !== null && this.lastCenterY !== null) {
      const dx = Math.abs(bestDetection.centerX - this.lastCenterX);
      const dy = Math.abs(bestDetection.centerY - this.lastCenterY);
      const maxJump = w * this.MAX_JUMP_FRACTION;
      if ((dx > maxJump || dy > maxJump) && bestDetection.confidence < 0.75) {
        return null; // Large jump with low confidence — different object
      }
    }

    this.lastCenterX = bestDetection.centerX;
    this.lastCenterY = bestDetection.centerY;

    return bestDetection;
  }

  reset(): void {
    this.lastCenterX = null;
    this.lastCenterY = null;
  }

  // --- Image processing primitives ---

  private toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float64Array {
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return gray;
  }

  private gaussianBlur(src: Float64Array, w: number, h: number): Float64Array {
    const dst = new Float64Array(w * h);
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += src[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dst[y * w + x] = sum / 16;
      }
    }
    return dst;
  }

  private sobelEdges(src: Float64Array, w: number, h: number): Float64Array {
    const edges = new Float64Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -src[(y - 1) * w + (x - 1)] + src[(y - 1) * w + (x + 1)]
          - 2 * src[y * w + (x - 1)] + 2 * src[y * w + (x + 1)]
          - src[(y + 1) * w + (x - 1)] + src[(y + 1) * w + (x + 1)];
        const gy =
          -src[(y - 1) * w + (x - 1)] - 2 * src[(y - 1) * w + x] - src[(y - 1) * w + (x + 1)]
          + src[(y + 1) * w + (x - 1)] + 2 * src[(y + 1) * w + x] + src[(y + 1) * w + (x + 1)];
        edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return edges;
  }

  private findComponents(
    binary: Int8Array | ArrayLike<number>,
    w: number,
    h: number
  ): Array<{ pixelCount: number; perimeter: number; bbox: { minX: number; maxX: number; minY: number; maxY: number } }> {
    const step = 2;
    const visited = new Uint8Array(w * h);
    const contours: Array<{ pixelCount: number; perimeter: number; bbox: { minX: number; maxX: number; minY: number; maxY: number } }> = [];

    const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

    const queue: Array<number> = [];

    for (let y = 1; y < h - 1; y += step) {
      for (let x = 1; x < w - 1; x += step) {
        const idx = y * w + x;
        if (binary[idx] === 0 || visited[idx]) continue;

        let pixelCount = 0;
        let perimeter = 0;
        let minX = x, maxX = x, minY = y, maxY = y;

        queue.length = 0;
        queue.push(idx);
        visited[idx] = 1;

        let qi = 0;
        while (qi < queue.length) {
          const cur = queue[qi++];
          const cx = cur % w;
          const cy = (cur - cx) / w;

          pixelCount++;

          let isPerimeter = false;
          for (let n = 0; n < 8; n++) {
            const nx = cx + dx8[n];
            const ny = cy + dy8[n];
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (binary[ny * w + nx] === 0) {
              isPerimeter = true;
            } else if (!visited[ny * w + nx]) {
              visited[ny * w + nx] = 1;
              queue.push(ny * w + nx);
            }
          }
          if (isPerimeter) perimeter++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          if (pixelCount > 50000) break;
        }

        if (pixelCount > 50 && perimeter > 15) {
          contours.push({
            pixelCount,
            perimeter,
            bbox: { minX, maxX, minY, maxY },
          });
        }
      }
    }

    return contours;
  }
}
