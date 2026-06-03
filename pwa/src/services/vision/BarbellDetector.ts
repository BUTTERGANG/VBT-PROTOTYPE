// src/services/vision/BarbellDetector.ts

import * as tf from '@tensorflow/tfjs';
import type { BarbellDetection } from './types';

/**
 * Detects barbell endcaps in video frames.
 *
 * Strategy:
 * 1. Primary: YOLO/TFLite model fine-tuned on barbell endcap images (not yet trained)
 * 2. Fallback: Contour-based circular shape detector for plate rims
 *
 * The fallback uses edge detection + contour finding to locate elliptical
 * shapes that match the expected profile of a barbell plate viewed from
 * the side. It handles perspective distortion (plates appear as ellipses
 * when viewed at an angle) and varying plate sizes.
 */
export class BarbellDetector {
  private model: tf.GraphModel | tf.LayersModel | null = null;
  private minConfidence: number;
  private useFallback: boolean = true;
  private fallbackDetector: ContourPlateDetector;

  // Track last detection for interpolation when detection is lost
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
      this.model = await tf.loadGraphModel('/models/barbell-detector/model.json');
      this.useFallback = false;
    } catch {
      console.warn('[BarbellDetector] TFLite model not found, using contour-based fallback');
      this.useFallback = true;
    }
  }

  async detect(canvas: HTMLCanvasElement): Promise<BarbellDetection | null> {
    let detection: BarbellDetection | null = null;

    if (this.useFallback || !this.model) {
      detection = this.fallbackDetector.detect(canvas);
    } else {
      detection = await this.detectWithModel(canvas);
    }

    // Smooth detection gaps: if we lose the plate for a few frames,
    // return the last known position (with decreasing confidence)
    if (detection) {
      this.lastDetection = detection;
      this.framesSinceDetection = 0;
    } else {
      this.framesSinceDetection++;
      if (this.framesSinceDetection <= this.MAX_INTERPOLATION_FRAMES && this.lastDetection) {
        // Return last detection with decayed confidence
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
 * 3. Run Canny-like edge detection (Sobel)
 * 4. Find contours by tracing connected edge pixels
 * 5. Fit bounding boxes to contours
 * 6. Score each contour as a likely plate rim based on:
 *    - Aspect ratio (should be roughly elliptical: 0.4 - 1.0)
 *    - Size relative to frame (plates are a significant feature)
 *    - Circularity measure (perimeter² / 4π_area ≈ 1 for circles)
 *    - Position (plates are usually in the lower 2/3 of the frame)
 */
class ContourPlateDetector {
  private minConfidence: number;

  constructor(minConfidence: number) {
    this.minConfidence = minConfidence;
  }

  detect(canvas: HTMLCanvasElement): BarbellDetection | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);

    // Step 1: Grayscale
    const gray = this.toGrayscale(imageData.data, w, h);

    // Step 2: Gaussian blur (3x3)
    const blurred = this.gaussianBlur(gray, w, h);

    // Step 3: Sobel edge detection
    const edges = this.sobelEdges(blurred, w, h);

    // Step 4: Threshold edges
    const edgeThreshold = 30;
    const binary = edges.map(v => v > edgeThreshold ? 1 : 0);

    // Step 5: Find connected components (simple flood fill)
    const contours = this.findComponents(binary, w, h);

    if (contours.length === 0) return null;

    // Step 6: Score each contour as a potential plate
    let bestDetection: BarbellDetection | null = null;
    let bestScore = 0;

    for (const contour of contours) {
      // Skip tiny contours (noise) and huge ones (background)
      const area = contour.pixelCount;
      if (area < 200 || area > (w * h * 0.3)) continue;

      const bbox = contour.bbox;
      const bw = bbox.maxX - bbox.minX;
      const bh = bbox.maxY - bbox.minY;

      if (bw < 30 || bh < 30) continue;

      // Aspect ratio score -- plates are roughly circular/elliptical
      const aspectRatio = Math.min(bw, bh) / Math.max(bw, bh);
      if (aspectRatio < 0.3) continue; // Too elongated
      const aspectScore = aspectRatio;

      // Circularity score -- how close to a circle/ellipse
      // perimeter² / (4π × area) ≈ 1 for a perfect circle
      const perimeter = contour.perimeter;
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      const circScore = Math.min(circularity, 1); // Cap at 1

      // Size score -- plates should be a notable feature
      // Ideal: 5-25% of frame width
      const sizeRatio = bw / w;
      const sizeScore = sizeRatio > 0.05 && sizeRatio < 0.4 ? 1 : 0.3;

      // Position score -- plates are usually in the middle-lower area
      const centerY = (bbox.minY + bbox.maxY) / 2;
      const posScore = (centerY / h > 0.2 && centerY / h < 0.9) ? 1 : 0.5;

      // Combined score
      const score = aspectScore * 0.3 + circScore * 0.3 + sizeScore * 0.2 + posScore * 0.2;

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

    if (bestDetection && bestDetection.confidence < this.minConfidence) {
      return null;
    }

    return bestDetection;
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
    // 3x3 Gaussian kernel: [1 2 1; 2 4 2; 1 2 1] / 16
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
        // Sobel X
        const gx =
          -src[(y - 1) * w + (x - 1)] + src[(y - 1) * w + (x + 1)]
          - 2 * src[y * w + (x - 1)] + 2 * src[y * w + (x + 1)]
          - src[(y + 1) * w + (x - 1)] + src[(y + 1) * w + (x + 1)];
        // Sobel Y
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
    // Downsample for performance -- process every 2nd pixel
    const step = 2;
    const visited = new Uint8Array(w * h);
    const contours: Array<{ pixelCount: number; perimeter: number; bbox: { minX: number; maxX: number; minY: number; maxY: number } }> = [];

    // 8-connected neighbor offsets
    const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

    const queue: Array<number> = [];

    for (let y = 1; y < h - 1; y += step) {
      for (let x = 1; x < w - 1; x += step) {
        const idx = y * w + x;
        if (binary[idx] === 0 || visited[idx]) continue;

        // BFS flood fill
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

          // Check if this is a perimeter pixel (has a non-edge neighbor)
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

          // Limit component size to prevent runaway
          if (pixelCount > 50000) break;
        }

        // Only keep substantial components
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
