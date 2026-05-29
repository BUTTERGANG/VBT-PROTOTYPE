// src/services/storage/LocalCache.ts

import Dexie, { type Table } from 'dexie';
import type { VelocityReading } from '../../types';

interface CachedReading {
  id?: number;
  sessionId: string;
  setNumber: number;
  repNumber: number;
  timestamp: number;
  velocity: number;
  synced: boolean;
}

interface CachedSession {
  id: string;
  athleteId: string;
  exercise: string;
  startTime: number;
  endTime?: number;
  synced: boolean;
}

const CIRCULAR_BUFFER_MAX = 3600; // 60 seconds at 60Hz

class VBTDatabase extends Dexie {
  readings!: Table<CachedReading, number>;
  sessions!: Table<CachedSession, string>;

  constructor() {
    super('VBTDatabase');
    this.version(1).stores({
      readings: '++id, sessionId, setNumber, repNumber, timestamp, synced',
      sessions: 'id, athleteId, startTime, synced',
    });
  }
}

class LocalCache {
  private db: VBTDatabase;
  private preRepBuffer: VelocityReading[] = [];
  private maxBufferSize = CIRCULAR_BUFFER_MAX;

  constructor() {
    this.db = new VBTDatabase();
  }

  addPreRepReading(reading: VelocityReading) {
    this.preRepBuffer.push(reading);
    if (this.preRepBuffer.length > this.maxBufferSize) {
      this.preRepBuffer.shift();
    }
  }

  getPreRepBuffer(): VelocityReading[] {
    return [...this.preRepBuffer];
  }

  clearPreRepBuffer() {
    this.preRepBuffer = [];
  }

  async createSession(athleteId: string, exercise: string): Promise<string> {
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await this.db.sessions.add({
      id,
      athleteId,
      exercise,
      startTime: Date.now(),
      synced: false,
    });
    return id;
  }

  async endSession(sessionId: string) {
    await this.db.sessions.update(sessionId, { endTime: Date.now() });
  }

  async addReading(sessionId: string, setNumber: number, repNumber: number, reading: VelocityReading) {
    await this.db.readings.add({
      sessionId,
      setNumber,
      repNumber,
      timestamp: reading.timestamp,
      velocity: reading.velocity,
      synced: false,
    });
  }

  async getReadingsForRep(sessionId: string, setNumber: number, repNumber: number): Promise<VelocityReading[]> {
    const cached = await this.db.readings
      .where({ sessionId, setNumber, repNumber })
      .sortBy('timestamp');
    return cached.map(r => ({
      timestamp: r.timestamp,
      velocity: r.velocity,
      source: 'ble' as const,
    }));
  }

  async getUnsyncedSessions(): Promise<CachedSession[]> {
    return this.db.sessions.where('synced').equals(0).toArray();
  }

  async getUnsyncedReadings(): Promise<CachedReading[]> {
    return this.db.readings.where('synced').equals(0).toArray();
  }

  async markSessionSynced(sessionId: string) {
    await this.db.sessions.update(sessionId, { synced: true });
  }

  async markReadingsSynced(ids: number[]) {
    // Dexie bulkUpdate expects { key, changes } format
    await this.db.readings.bulkPut(
      ids.map(id => ({ id, synced: true } as CachedReading))
    );
  }

  async getSessionHistory(limit = 50): Promise<CachedSession[]> {
    return this.db.sessions.orderBy('startTime').reverse().limit(limit).toArray();
  }

  async getSessionReadings(sessionId: string): Promise<CachedReading[]> {
    return this.db.readings.where({ sessionId }).sortBy('timestamp');
  }

  async clearOldData(olderThanDays = 30) {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    await this.db.readings.where('timestamp').below(cutoff).and(r => r.synced).delete();
    await this.db.sessions.where('startTime').below(cutoff).and(s => s.synced).delete();
  }
}

export const localCache = new LocalCache();
