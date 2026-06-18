// src/types/index.ts

export interface User {
  id: string;
  email: string;
}

export interface ZoneConfig {
  targetVelocity: number;
  tolerance: number;
}

export type ZoneResult = 'FAST' | 'IN_RANGE' | 'SLOW';

export interface VelocityReading {
  timestamp: number;
  velocity: number;
  source?: string;
}

export interface VisionSettings {
  /** Plate diameter in mm for scale calibration */
  plateDiameterMm: number;
  /** Whether the user has completed camera calibration */
  isCalibrated: boolean;
  /** Pixels per mm at the barbell depth plane */
  pixelsPerMm: number;
  /** Selected exercise category for camera mode */
  exerciseCategory: string;
  /** Whether video recording is enabled for the set */
  recordingEnabled: boolean;
}

export interface Rep {
  id?: string;
  repNumber: number;
  meanVelocity: number;
  peakVelocity: number;
  zoneResult: ZoneResult;
  readings: VelocityReading[];
  estimated1rm?: number;
}

export interface SetData {
  id?: string;
  setNumber: number;
  exercise: string;
  reps: Rep[];
  targetVelocity?: number;
  tolerance?: number;
}

export interface Session {
  id: string;
  athleteId: string | null;
  exercise: string;
  startTime: string;
  endTime?: string;
  sets: SetData[];
  notes?: string;
  tags?: string[];
  // Computed
  totalReps?: number;
  avgVelocity?: number;
}

export interface Athlete {
  id: string;
  name: string;
  bodyweight?: number;
  primaryLifts: string[];
  baselineVelocity?: number;
  fatigueThreshold?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Program {
  id: string;
  athleteId: string;
  name: string;
  description?: string;
  weeks: ProgramWeek[];
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgramWeek {
  week: number;
  sessions: ProgramSession[];
}

export interface ProgramSession {
  day: number;
  exercise: string;
  sets: number;
  reps: number;
  targetVelocity?: number;
}

export type BLEState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BLEDataPacket {
  athleteId: string;
  sessionId: string;
  velocity: number;
  zone: ZoneResult;
  repNumber: number;
  setNumber: number;
  timestamp: number;
}

export interface DashboardAnalytics {
  velocityTrend: VelocityTrendPoint[];
  zoneDistribution: ZoneDistribution[];
  fatigueAlerts: FatigueAlert[];
  programAdherence: ProgramAdherence[];
}

export interface VelocityTrendPoint {
  exercise: string;
  sessionDate: string;
  avgVelocity: number;
  maxPeak: number;
  totalReps: number;
}

export interface ZoneDistribution {
  zoneResult: ZoneResult;
  count: number;
  percentage: number;
}

export interface FatigueAlert {
  sessionId: string;
  exercise: string;
  startTime: string;
  fatigueFlag: boolean;
  autoregScore?: number;
  setNumber: number;
  velocityDropPct: number;
}

export interface ProgramAdherence {
  programName: string;
  sessionsCompleted: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}
