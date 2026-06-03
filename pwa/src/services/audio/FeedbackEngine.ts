// src/services/audio/FeedbackEngine.ts

import type { ZoneResult } from '../../types';

/**
 * Audio feedback engine for VBT.
 *
 * Feedback types:
 * - Target speed cue: beep when entering target velocity zone
 * - Loss cue: alert when velocity drops below loss threshold
 * - Rep complete: distinct tone when a rep finishes
 * - Metronome: steady tempo beeps for pacing eccentrics
 *
 * All sounds generated procedurally with Web Audio API.
 */
export class FeedbackEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private lastZoneTone: number = 0;
  private lastLossTone: number = 0;
  private readonly ZONE_TONE_COOLDOWN = 1500;
  private readonly LOSS_TONE_COOLDOWN = 3000;

  // Metronome state
  private metronomeInterval: ReturnType<typeof setInterval> | null = null;
  private metronomeBpm: number = 0;
  private metronomeEnabled: boolean = false;

  // Loss detection
  private bestVelocityInSet: number = 0;
  private lossThreshold: number = 0.20; // 20%
  private lossCueEnabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Zone feedback ---

  playZoneTone(zone: ZoneResult): void {
    const now = Date.now();
    if (now - this.lastZoneTone < this.ZONE_TONE_COOLDOWN) return;
    this.lastZoneTone = now;

    switch (zone) {
      case 'IN_RANGE':
        this.beep(880, 0.12);
        break;
      case 'FAST':
        this.twoTone(660, 880, 0.1);
        break;
      case 'SLOW':
        this.twoTone(880, 660, 0.1);
        break;
    }
  }

  // --- Loss cue ---

  /**
   * Check velocity for loss and play cue if significant drop.
   * Call this on every velocity reading during a set.
   * @returns true if a loss was detected
   */
  checkVelocityLoss(velocity: number): boolean {
    if (!this.lossCueEnabled || !this.enabled) return false;

    // Track best velocity in set
    if (velocity > this.bestVelocityInSet) {
      this.bestVelocityInSet = velocity;
    }

    // Need at least a few readings to establish a baseline
    if (this.bestVelocityInSet < 0.1) return false;

    // Check for velocity loss
    const lossRatio = 1 - (velocity / this.bestVelocityInSet);
    if (lossRatio >= this.lossThreshold) {
      const now = Date.now();
      if (now - this.lastLossTone >= this.LOSS_TONE_COOLDOWN) {
        this.lastLossTone = now;
        this.playLossAlert();
        return true;
      }
    }

    return false;
  }

  /**
   * Set the loss threshold (0-1, e.g. 0.20 = 20% velocity drop).
   */
  setLossThreshold(threshold: number): void {
    this.lossThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Enable or disable the loss cue.
   */
  setLossCueEnabled(enabled: boolean): void {
    this.lossCueEnabled = enabled;
  }

  /**
   * Reset loss tracking for a new set.
   */
  resetLossTracking(): void {
    this.bestVelocityInSet = 0;
  }

  // --- Rep/Set events ---

  playRepComplete(): void {
    this.doubleBeep(1000, 0.08, 0.06);
  }

  playSetComplete(): void {
    this.tripleTone(600, 800, 1000, 0.15);
  }

  playLossAlert(): void {
    this.twoTone(440, 330, 0.2);
  }

  // --- Metronome ---

  /**
   * Start the metronome at the given BPM.
   */
  startMetronome(bpm: number): void {
    this.stopMetronome();
    if (!this.enabled || bpm <= 0) return;

    this.metronomeBpm = bpm;
    this.metronomeEnabled = true;
    const intervalMs = 60000 / bpm;

    this.metronomeInterval = setInterval(() => {
      this.beep(600, 0.05);
    }, intervalMs);
  }

  /**
   * Stop the metronome.
   */
  stopMetronome(): void {
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
    this.metronomeEnabled = false;
  }

  /**
   * Change metronome BPM while running.
   */
  setMetronomeBpm(bpm: number): void {
    if (this.metronomeEnabled) {
      this.startMetronome(bpm);
    }
  }

  isMetronomeRunning(): boolean {
    return this.metronomeEnabled;
  }

  getMetronomeBpm(): number {
    return this.metronomeBpm;
  }

  // --- Global controls ---

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopMetronome();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    this.stopMetronome();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  // --- Private: Tone generators ---

  private beep(freq: number, duration: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.stop(now + duration + 0.01);
  }

  private twoTone(freq1: number, freq2: number, eachDuration: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = freq1;
    gain1.gain.value = 0.25;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + eachDuration);
    osc1.stop(now + eachDuration + 0.01);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = freq2;
    gain2.gain.value = 0.25;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + eachDuration + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + eachDuration * 2 + 0.03);
    osc2.stop(now + eachDuration * 2 + 0.04);
  }

  private doubleBeep(freq: number, dur: number, gap: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * (dur + gap);
      osc.start(start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.stop(start + dur + 0.01);
    }
  }

  private tripleTone(f1: number, f2: number, f3: number, dur: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [f1, f2, f3].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.25;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * (dur + 0.04);
      osc.start(start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.stop(start + dur + 0.01);
    });
  }
}

export const feedbackEngine = new FeedbackEngine();
