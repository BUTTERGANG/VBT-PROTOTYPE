// src/components/LiveLiftScreen.tsx

import { useEffect, useRef } from 'react';
import { useLiftStore } from '../store/liftStore';
import { bleManager } from '../services/ble/BLEManager';

export function LiveLiftScreen() {
  const { currentVelocity, currentZone, bleState, zoneConfig } = useLiftStore();
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // No more manual rest ticking — device handles set progression

  useEffect(() => {
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  const zoneColor =
    currentZone === 'FAST' ? '#ef4444' :
    currentZone === 'IN_RANGE' ? '#10b981' : '#6b7280';

  const lowerBound = zoneConfig.targetVelocity - zoneConfig.tolerance;
  const upperBound = zoneConfig.targetVelocity + zoneConfig.tolerance;

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: 'calc(100vh - 120px)',
        padding: 'var(--space-4)',
        paddingBottom: '80px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Live Lift
          </h1>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Device display — PWA mirror
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
            {bleState === 'connected' ? 'LIVE' : bleState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Device notice */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          textAlign: 'center',
          padding: 'var(--space-6)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📱</div>
        <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
          Lift data displayed on-device
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          The VBT sensor shows live velocity, zone, and rep count on its display.
          This screen mirrors the data stream for reference.
        </div>
      </div>

      {/* Current velocity mirror (when BLE connected) */}
      {bleState === 'connected' && (
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '500px',
            textAlign: 'center',
            padding: 'var(--space-6)',
            border: `2px solid ${zoneColor}33`,
          }}
        >
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>
            LIVE VELOCITY
          </div>
          <div
            className="text-display"
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: zoneColor,
              fontSize: 'clamp(40px, 12vw, 72px)',
              lineHeight: 1,
              marginBottom: 'var(--space-3)',
            }}
          >
            {currentVelocity.toFixed(2)}
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            m/s
          </div>

          {/* Zone bar */}
          <div
            className="flex items-center justify-center"
            style={{
              padding: 'var(--space-3)',
              backgroundColor: `${zoneColor}15`,
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${zoneColor}33`,
            }}
          >
            <span className="text-subheading" style={{ color: zoneColor, fontFamily: 'var(--font-mono)' }}>
              {currentZone === 'IN_RANGE' ? '✓ IN ZONE' : currentZone === 'FAST' ? '↑ TOO FAST' : '↓ TOO SLOW'}
            </span>
          </div>

          {/* Zone range */}
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-3)', fontFamily: 'var(--font-mono)' }}>
            Target: {lowerBound.toFixed(2)} – {upperBound.toFixed(2)} m/s
          </div>
        </div>
      )}

      {/* Connect button */}
      {bleState !== 'connected' && (
        <button
          onClick={() => bleManager.scanAndConnect()}
          className="btn btn-pill btn-brand"
          style={{ padding: 'var(--space-3) var(--space-6)', fontSize: '14px' }}
        >
          Connect to VBT Device
        </button>
      )}
    </div>
  );
}
