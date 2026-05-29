// src/store/liftStore.ts

import { create } from 'zustand';
import type { VelocityReading, Rep, ZoneResult, ZoneConfig, BLEState, BLEDataPacket, Session, Athlete, Program } from '../types';
import { calculateZone } from '../utils/zoneCalculator';
import { bleManager } from '../services/ble/BLEManager';
import { localCache } from '../services/storage/LocalCache';

interface LiftState {
  // Session state
  sessionId: string | null;
  exercise: string;
  isActive: boolean;
  completedReps: Rep[];
  currentVelocity: number;
  zoneConfig: ZoneConfig;
  currentZone: ZoneResult;

  // BLE observer state
  bleState: BLEState;
  // Coach mode: multiple athletes streaming live data
  liveAthletes: Record<string, BLEDataPacket>;

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

  // BLE observer
  handleBLEData: (packet: BLEDataPacket) => void;

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
  bleState: bleManager.getState(),
  liveAthletes: {},
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
    const { sessionId } = get();
    if (sessionId) {
      await localCache.endSession(sessionId);
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
    // Simplified: just track that a rep was completed
    // Full rep processing happens on-device
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

  handleBLEData: (packet: BLEDataPacket) => {
    set((state) => ({
      liveAthletes: {
        ...state.liveAthletes,
        [packet.athleteId]: packet,
      },
    }));
  },

  setAthletes: (athletes: Athlete[]) => set({ athletes }),
  setPrograms: (programs: Program[]) => set({ programs }),
  setRecentSessions: (sessions: Session[]) => set({ recentSessions: sessions }),
}));
