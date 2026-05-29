// src/utils/velocityProcessor.ts

import type { VelocityReading } from '../types';

const ROLLING_WINDOW_SIZE = 5;
const OUTLIER_THRESHOLD = 0.15; // m/s

export function smoothVelocity(readings: VelocityReading[]): number[] {
  if (readings.length === 0) return [];
  if (readings.length < ROLLING_WINDOW_SIZE) {
    return readings.map(r => r.velocity);
  }

  const smoothed: number[] = [];

  for (let i = 0; i < readings.length; i++) {
    if (i < ROLLING_WINDOW_SIZE - 1) {
      smoothed.push(readings[i].velocity);
    } else {
      const window = readings.slice(i - ROLLING_WINDOW_SIZE + 1, i + 1);
      const avg = window.reduce((sum, r) => sum + r.velocity, 0) / ROLLING_WINDOW_SIZE;
      const current = readings[i].velocity;
      if (Math.abs(current - avg) > OUTLIER_THRESHOLD) {
        smoothed.push(avg);
      } else {
        smoothed.push(current);
      }
    }
  }

  return smoothed;
}

export function calculateMeanVelocity(readings: VelocityReading[]): number {
  if (readings.length === 0) return 0;
  const smoothed = smoothVelocity(readings);
  const sum = smoothed.reduce((acc, v) => acc + v, 0);
  return sum / smoothed.length;
}

export function calculatePeakVelocity(readings: VelocityReading[]): number {
  if (readings.length === 0) return 0;
  return Math.max(...readings.map(r => r.velocity));
}

export function estimate1RM(velocity: number, load: number, v1RM: number = 0.15): number {
  const percent1RM = (v1RM - velocity) / v1RM;
  return load / (1 - percent1RM);
}

export function formatVelocity(velocity: number): string {
  return velocity.toFixed(2);
}
