// src/services/recording/SetRecorder.ts

import type { BarPosition } from '../vision/types';
import type { VelocityReading } from '../../types';

/**
 * Source type for how the video was obtained.
 */
export type VideoSource = 'camera-live' | 'camera-recorded' | 'file-upload';

/**
 * Records a set with video + velocity data for post-session review.
 *
 * Three input modes:
 * 1. Camera live (no recording) -- process camera stream, no video saved
 * 2. Camera recorded -- process camera stream AND record video via MediaRecorder
 * 3. File upload -- process a pre-recorded video file from the user's gallery
 *
 * After a set is completed, provides the recording for:
 * - Playback with bar path overlay
 * - Export/download
 * - Upload to backend for cloud storage
 */
export class SetRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private positions: BarPosition[] = [];
  private readings: VelocityReading[] = [];
  private startTime: number = 0;
  private isRecording = false;
  private source: VideoSource = 'camera-live';

  /**
   * Start recording from the live camera stream.
   * @param stream The MediaStream from the camera
   * @param recordVideo Whether to save the video (true) or just track data (false)
   */
  start(stream: MediaStream, recordVideo: boolean = true): void {
    if (this.isRecording) return;

    this.chunks = [];
    this.positions = [];
    this.readings = [];
    this.startTime = Date.now();
    this.isRecording = true;

    if (recordVideo) {
      this.source = 'camera-recorded';
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000);
    } else {
      this.source = 'camera-live';
      this.mediaRecorder = null;
    }
  }

  /**
   * Start from an uploaded video file.
   * Does not use MediaRecorder -- the video already exists.
   * @param file The uploaded video file
   */
  startFromUpload(file: File): void {
    if (this.isRecording) return;

    this.chunks = [file];
    this.positions = [];
    this.readings = [];
    this.startTime = Date.now();
    this.isRecording = true;
    this.source = 'file-upload';
    this.mediaRecorder = null;
  }

  /**
   * Add a bar position to the recording log.
   */
  addPosition(position: BarPosition): void {
    if (!this.isRecording) return;
    this.positions.push(position);
  }

  /**
   * Add a velocity reading to the recording log.
   */
  addReading(reading: VelocityReading): void {
    if (!this.isRecording) return;
    this.readings.push(reading);
  }

  /**
   * Stop recording and return the result.
   */
  async stop(): Promise<SetRecording | null> {
    if (!this.isRecording) {
      return null;
    }

    // For file uploads or live-only, no MediaRecorder to stop
    if (this.source === 'file-upload') {
      const videoBlob = this.chunks[0] instanceof Blob ? this.chunks[0] : new Blob(this.chunks);
      const recording: SetRecording = {
        videoBlob,
        videoUrl: URL.createObjectURL(videoBlob),
        source: this.source,
        positions: [...this.positions],
        readings: [...this.readings],
        duration: Date.now() - this.startTime,
        startTime: this.startTime,
        endTime: Date.now(),
        fileName: (videoBlob as File).name,
      };
      this.reset();
      return recording;
    }

    if (this.source === 'camera-live') {
      // No video to save, just return the data
      const recording: SetRecording = {
        videoBlob: new Blob(),
        videoUrl: null,
        source: this.source,
        positions: [...this.positions],
        readings: [...this.readings],
        duration: Date.now() - this.startTime,
        startTime: this.startTime,
        endTime: Date.now(),
      };
      this.reset();
      return recording;
    }

    // camera-recorded: stop MediaRecorder and assemble video
    if (!this.mediaRecorder) {
      this.reset();
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const videoBlob = new Blob(this.chunks, { type: this.chunks[0]?.type || 'video/webm' });

        const recording: SetRecording = {
          videoBlob,
          videoUrl: URL.createObjectURL(videoBlob),
          source: this.source,
          positions: [...this.positions],
          readings: [...this.readings],
          duration: Date.now() - this.startTime,
          startTime: this.startTime,
          endTime: Date.now(),
        };

        this.reset();
        resolve(recording);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancel recording without saving.
   */
  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.reset();
  }

  private reset(): void {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.chunks = [];
    this.positions = [];
    this.readings = [];
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getElapsedSeconds(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  getSource(): VideoSource {
    return this.source;
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  }
}

/**
 * A completed set recording with video and data.
 */
export interface SetRecording {
  /** Video blob (empty for camera-live mode) */
  videoBlob: Blob;
  /** Object URL for playback (null for camera-live mode) */
  videoUrl: string | null;
  /** How the video was sourced */
  source: VideoSource;
  /** Bar positions logged during the set */
  positions: BarPosition[];
  /** Velocity readings logged during the set */
  readings: VelocityReading[];
  /** Duration in ms */
  duration: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Original filename (for uploads only) */
  fileName?: string;
}

/**
 * Accept a user-selected video file for upload.
 * Validates it's a video and within size limits.
 */
export function acceptVideoFile(file: File): { valid: boolean; error?: string } {
  // Check it's a video
  if (!file.type.startsWith('video/')) {
    return { valid: false, error: 'File must be a video (MP4, MOV, WebM)' };
  }

  // Check size limit: 200MB
  const MAX_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 200MB.` };
  }

  return { valid: true };
}

/**
 * Revoke a video object URL (cleanup).
 */
export function revokeVideoUrl(url: string): void {
  URL.revokeObjectURL(url);
}
