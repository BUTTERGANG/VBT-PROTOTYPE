// src/components/CoachModeScreen.tsx

import { useEffect } from 'react';
import { useLiftStore } from '../store/liftStore';
import { bleManager } from '../services/ble/BLEManager';
import type { BLEDataPacket } from '../types';

const ZONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FAST: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  IN_RANGE: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  SLOW: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
};

const ZONE_LABELS: Record<string, string> = {
  FAST: 'FAST',
  IN_RANGE: 'IN ZONE',
  SLOW: 'SLOW',
};

export function CoachModeScreen() {
  const { liveAthletes, athletes, bleState, handleBLEData } = useLiftStore();

  useEffect(() => {
    // Subscribe to BLE data packets for coach view
    const unsubscribe = bleManager.subscribeData((packet: BLEDataPacket) => {
      handleBLEData(packet);
    });
    return unsubscribe;
  }, [handleBLEData]);

  const athleteList = Object.values(liveAthletes);
  const connectedAthletes = athleteList.filter((a) => a.athleteId);

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        <div>
          <h2 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>Coach View</h2>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Live athlete monitoring
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: bleState === 'connected' ? '#10b981' : '#6b7280',
            }}
          />
          <span className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {bleState === 'connected' ? 'BLE ACTIVE' : 'BLE OFFLINE'}
          </span>
        </div>
      </div>

      {/* Idle state */}
      {connectedAthletes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '40px', marginBottom: 'var(--space-3)' }}>📡</div>
          <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Waiting for athletes...
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', maxWidth: '280px', margin: '0 auto' }}>
            Athletes using the VBT device nearby will appear here in real-time.
            Their live velocity, zone, and rep data streams via BLE.
          </div>
          <div className="flex gap-2" style={{ marginTop: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {athletes.slice(0, 6).map((athlete: any) => (
              <span
                key={athlete.id}
                className="text-caption"
                style={{
                  color: 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-bg)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {athlete.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Athlete cards */
        <div className="flex flex-col gap-3">
          {connectedAthletes.map((packet) => {
            const zoneStyle = ZONE_COLORS[packet.zone] || ZONE_COLORS.SLOW;
            const athleteName =
              athletes.find((a: any) => a.id === packet.athleteId)?.name || `Athlete ${packet.athleteId.slice(0, 4)}`;

            return (
              <div
                key={packet.athleteId}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  border: `2px solid ${zoneStyle.border}`,
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Athlete header */}
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                    {athleteName}
                  </div>
                  <span
                    className="text-caption"
                    style={{
                      color: zoneStyle.text,
                      backgroundColor: zoneStyle.bg,
                      padding: '2px 10px',
                      borderRadius: '999px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      border: `1px solid ${zoneStyle.border}`,
                    }}
                  >
                    {ZONE_LABELS[packet.zone] || packet.zone}
                  </span>
                </div>

                {/* Big velocity — matches device display */}
                <div className="flex items-baseline gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                  <span
                    className="text-display"
                    style={{ color: zoneStyle.text, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  >
                    {packet.velocity.toFixed(2)}
                  </span>
                  <span className="text-body" style={{ color: 'var(--color-text-muted)' }}>m/s</span>
                </div>

                {/* Set/Rep progress */}
                <div className="flex gap-4">
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
                      SET
                    </span>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '18px' }}>
                      {packet.setNumber}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
                      REP
                    </span>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '18px' }}>
                      {packet.repNumber}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
                      UPDATE
                    </span>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '18px' }}>
                      {((Date.now() - packet.timestamp) / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection legend */}
      <div className="flex gap-4" style={{ marginTop: 'var(--space-5)', justifyContent: 'center' }}>
        {Object.entries(ZONE_COLORS).map(([zone, style]) => (
          <div key={zone} className="flex items-center gap-1.5">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: style.text }} />
            <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              {ZONE_LABELS[zone]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
