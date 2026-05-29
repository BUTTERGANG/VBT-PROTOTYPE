// src/services/ble/BLEManager.ts

import type { VelocityReading, BLEState, BLEDataPacket, ZoneResult } from '../../types';

// BLE UUIDs — Seeed XIAO nRF52840 Sense with Zephyr firmware
// Replace with actual UUIDs once firmware is confirmed
const VBT_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const VELOCITY_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

type StateListener = (state: BLEState) => void;
type VelocityListener = (reading: VelocityReading) => void;
type DataListener = (packet: BLEDataPacket) => void;

// BLE packet format from Zephyr firmware:
// Bytes 0-3:   velocity (float32, m/s, little-endian)
// Byte  4:     zone (0=SLOW, 1=IN_RANGE, 2=FAST)
// Bytes 5-6:   rep_number (uint16)
// Bytes 7-8:   set_number (uint16)
// Bytes 9-16:  timestamp (uint64, ms since epoch)
// Bytes 17-32: athlete_id (16 bytes, UUID string without dashes)

const ZONE_MAP: ZoneResult[] = ['SLOW', 'IN_RANGE', 'FAST'];

class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private state: BLEState = 'disconnected';
  private stateListeners: Set<StateListener> = new Set();
  private velocityListeners: Set<VelocityListener> = new Set();
  private dataListeners: Set<DataListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  private static instance: BLEManager;
  static getInstance(): BLEManager {
    if (!BLEManager.instance) {
      BLEManager.instance = new BLEManager();
    }
    return BLEManager.instance;
  }

  private notifyState(state: BLEState) {
    this.state = state;
    this.stateListeners.forEach((l) => l(state));
  }

  private notifyVelocity(reading: VelocityReading) {
    this.velocityListeners.forEach((l) => l(reading));
  }

  private notifyData(packet: BLEDataPacket) {
    this.dataListeners.forEach((l) => l(packet));
    // Also notify velocity listeners for backward compat
    this.notifyVelocity({ timestamp: packet.timestamp, velocity: packet.velocity, source: 'ble' });
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribeVelocity(listener: VelocityListener): () => void {
    this.velocityListeners.add(listener);
    return () => this.velocityListeners.delete(listener);
  }

  subscribeData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  getState(): BLEState {
    return this.state;
  }

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  async scanAndConnect(): Promise<void> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Bluetooth not supported. Requires Chrome on Android or desktop.');
      }

      this.notifyState('connecting');

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [VBT_SERVICE_UUID] },
          { namePrefix: 'VBT' },
        ],
        optionalServices: [VBT_SERVICE_UUID],
      });

      if (!this.device) throw new Error('No device selected');

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

      this.server = await this.device.gatt!.connect();
      this.notifyState('connected');
      this.reconnectAttempts = 0;

      const service = await this.server.getPrimaryService(VBT_SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(VELOCITY_CHARACTERISTIC_UUID);
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

    } catch (error: unknown) {
      this.notifyState('error');
      throw error;
    }
  }

  private handleData(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value || value.byteLength < 17) return;

    const velocity = value.getFloat32(0, true);
    const zoneIdx = Math.min(Math.max(value.getUint8(4), 0), 2);
    const zone = ZONE_MAP[zoneIdx];
    const repNumber = value.getUint16(5, true);
    const setNumber = value.getUint16(7, true);
    const timestamp = Number(value.getBigUint64(9, true));
    // Athlete ID from bytes 17-32
    let athleteId = '';
    for (let i = 17; i < Math.min(value.byteLength, 33); i++) {
      athleteId += String.fromCharCode(value.getUint8(i));
    }
    athleteId = athleteId.replace(/\0/g, '') || 'unknown';

    const packet: BLEDataPacket = {
      athleteId,
      sessionId: '', // Filled by store
      velocity,
      zone,
      repNumber,
      setNumber,
      timestamp,
    };

    this.notifyData(packet);
  }

  private handleDisconnect() {
    this.notifyState('disconnected');
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.device) {
      this.reconnectAttempts++;
      setTimeout(() => {
        if (this.device?.gatt) {
          this.scanAndConnect().catch(() => {});
        }
      }, 2000 * this.reconnectAttempts);
    }
  }

  async disconnect(): Promise<void> {
    if (this.characteristic) {
      try { await this.characteristic.stopNotifications(); } catch { /* ignore */ }
    }
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.notifyState('disconnected');
  }
}

export const bleManager = BLEManager.getInstance();
