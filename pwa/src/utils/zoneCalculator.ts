// src/utils/zoneCalculator.ts

import type { ZoneResult, ZoneConfig } from '../types';

export function calculateZone(velocity: number, config: ZoneConfig): ZoneResult {
  const { targetVelocity, tolerance } = config;
  const lowerBound = targetVelocity - tolerance;
  const upperBound = targetVelocity + tolerance;

  if (velocity < lowerBound) return 'SLOW';
  if (velocity > upperBound) return 'FAST';
  return 'IN_RANGE';
}

export function getZoneColor(zone: ZoneResult): string {
  switch (zone) {
    case 'IN_RANGE': return '#22c55e';
    case 'FAST': return '#eab308';
    case 'SLOW': return '#ef4444';
  }
}

export function getZoneLabel(zone: ZoneResult): string {
  switch (zone) {
    case 'IN_RANGE': return 'In Zone';
    case 'FAST': return 'Too Fast';
    case 'SLOW': return 'Too Slow';
  }
}
