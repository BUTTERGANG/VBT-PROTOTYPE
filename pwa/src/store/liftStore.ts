// src/store/liftStore.ts

import { create } from 'zustand';
import type { VelocityReading, Rep, ZoneResult, ZoneConfig, BLEState, BLEDataPacket, Session, Athlete, Program, VisionSettings } from '../types';
import { calculateZone } from '../utils/zoneCalculator';
import { bleManager } from '../services/ble/BLEManager';
import { localCache } from '../services/storage/LocalCache';

export type CaptureSource = 'ble' | 'camera' | null;

interface LiftState {
  // Session state
  sessionId: string | null;
  exercise: string;
  isActive: boolean;
  completedReps: Rep[];
  currentVelocity: number;
  zoneConfig: ZoneConfig;
  currentZone: ZoneResult;

  // Capture source
  captureSource: CaptureSource;

  // BLE observer state
  bleState: BLEState;
  // Coach mode: multiple athletes streaming live data
  liveAthletes: Record<string, BLEDataPacket>;

  // Vision state
  visionSettings: VisionSettings;

  // Data
  athletes: Athlete[];
  programs: Program[];
  recentSessions: Session[];

  // Actions
  startSession: (exercise: string) => Promise<void>;
  endSession: () => Promise<void>;
  addReading: (reading: VelocityReading) => void;
  stopRep: () => void;
  setZoneConfig: (config: ZoneConfig) => void;
  setExercise: (exercise: string) => void;
  setCaptureSource: (source: CaptureSource) => void;

  // BLE observer
  handleBLEData: (packet: BLEDataPacket) => void;

  // Vision actions
  updateVisionSettings: (settings: Partial<VisionSettings>) => void;

  // Data actions
  setAthletes: (athletes: Athlete[]) => void;
  setPrograms: (programs: Program[]) => void;
  setRecentSessions: (sessions: Session[]) => void;
}

export const useLiftStore = create<LiftState>((set, get) => ({
  sessionId: null,
  exercise: 'Squat',
  isActive: false,
  completedReps: [],
  currentVelocity: 0,
  zoneConfig: { targetVelocity: 0.80, tolerance: 0.05 },
  currentZone: 'SLOW',
  captureSource: null,
  bleState: bleManager.getState(),
  liveAthletes: {},
  visionSettings: {
    plateDiameterMm: 450,
    isCalibrated: false,
    pixelsPerMm: 0,
    exerciseCategory: 'squat',
    recordingEnabled: true,
  },
  athletes: [],
  programs: [],
  recentSessions: [],

  startSession: async (exercise: string) => {
    const sessionId = await localCache.createSession('default', exercise);
    bleManager.subscribeState((bleState) => {
      set({ bleState });
    });
    set({
      sessionId,
      exercise,
      completedReps: [],
      isActive: true,
      currentVelocity: 0,
      currentZone: 'SLOW',
    });
  },

  endSession: async () => {
    const { sessionId, completedReps, exercise } = get();
    if (sessionId) {
      await localCache.endSession(sessionId);
    }

    // Try syncing to backend in the background
    if (sessionId && completedReps.length > 0) {
      try {
        const { api } = await import('../services/api/client');
        await api.syncBatch({
          sessions: [{
            id: sessionId,
            athlete_id: 'default',
            exercise,
            start_time: new Date().toISOString(),
            sets: [{
              set_number: 1,
              reps: completedReps.map(r => ({
                rep_number: r.repNumber,
                mean_velocity: r.meanVelocity,
                peak_velocity: r.peakVelocity,
                zone_result: r.zoneResult,
              })),
            }],
          }],
        });
        await localCache.markSessionSynced(sessionId);
      } catch (err) {
        console.warn('Background sync failed, data saved locally:', err);
      }
    }

    set({
      sessionId: null,
      isActive: false,
      completedReps: [],
      currentVelocity: 0,
      currentZone: 'SLOW',
      liveAthletes: {},
    });
  },

  addReading: (reading: VelocityReading) => {
    const { zoneConfig } = get();
    const currentVelocity = reading.velocity;
    const currentZone = calculateZone(currentVelocity, zoneConfig);
    set({ currentVelocity, currentZone });
  },

  stopRep: () => {
    const { completedReps } = get();
    set({ completedReps: [...completedReps, {
      repNumber: completedReps.length + 1,
      meanVelocity: get().currentVelocity,
      peakVelocity: get().currentVelocity,
      zoneResult: get().currentZone,
      readings: [],
    }] });
  },

  setZoneConfig: (config: ZoneConfig) => {
    set({ zoneConfig: config });
  },

  setExercise: (exercise: string) => {
    set({ exercise });
  },

  setCaptureSource: (source: CaptureSource) => {
    set({ captureSource: source });
  },

  handleBLEData: (packet: BLEDataPacket) => {
    set((state) => ({
      liveAthletes: {
        ...state.liveAthletes,
        [packet.athleteId]: packet,
      },
    }));
  },

  updateVisionSettings: (settings: Partial<VisionSettings>) => {
    set((state) => ({
      visionSettings: { ...state.visionSettings, ...settings },
    }));
  },

  setAthletes: (athletes: Athlete[]) => set({ athletes }),
  setPrograms: (programs: Program[]) => set({ programs }),
  setRecentSessions: (sessions: Session[]) => set({ recentSessions: sessions }),
}));
