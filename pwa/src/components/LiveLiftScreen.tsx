// src/components/LiveLiftScreen.tsx

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiftStore } from '../store/liftStore';
import { bleManager } from '../services/ble/BLEManager';
import { ZoneConfigPanel } from './ZoneConfigPanel';

export function LiveLiftScreen() {
  const navigate = useNavigate();
  const { currentVelocity, currentZone, bleState, zoneConfig, setZoneConfig } = useLiftStore();
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showZoneConfig, setShowZoneConfig] = useState(false);

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

  const isConnecting = bleState === 'connecting';
  const isError = bleState === 'error';

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Live Lift
          </h1>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            BLE device mirror
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnecting && <div className="spinner" />}
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: bleState === 'connected' ? '#10b981' : isError ? '#ef4444' : '#6b7280',
          }} />
          <span className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {bleState === 'connected' ? 'LIVE' : bleState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid #ef4444', padding: 'var(--space-4)' }}>
          <div className="text-body-sm" style={{ color: '#ef4444', marginBottom: 'var(--space-2)' }}>
            ⚠ Connection failed
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
            Make sure your VBT device is powered on and in range. Web Bluetooth requires Chrome on Android/desktop.
          </div>
          <button
            onClick={() => bleManager.scanAndConnect()}
            className="btn btn-pill btn-brand"
            style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Connecting state */}
      {isConnecting && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-6)' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
          <div className="text-body" style={{ color: 'var(--color-text-primary)' }}>Scanning for device...</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Make sure your VBT sensor is powered on
          </div>
        </div>
      )}

      {/* Device notice (when not connected) */}
      {bleState !== 'connected' && !isConnecting && !isError && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-6)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📱</div>
          <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Connect your VBT device
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Web Bluetooth requires Chrome on Android or desktop. For iPhone, use Camera Mode instead.
          </div>
          <button
            onClick={() => bleManager.scanAndConnect()}
            className="btn btn-pill btn-brand"
            style={{ padding: 'var(--space-3) var(--space-6)', fontSize: '14px' }}
          >
            Scan for Device
          </button>
          <button
            onClick={() => navigate('/camera')}
            className="btn btn-pill"
            style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', fontSize: '12px', color: 'var(--color-text-muted)' }}
          >
            Or use Camera Mode →
          </button>
        </div>
      )}

      {/* Current velocity mirror (when BLE connected) */}
      {bleState === 'connected' && (
        <div
          className="card"
          style={{ marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-6)', border: `2px solid ${zoneColor}33` }}
        >
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>
            LIVE VELOCITY
          </div>
          <div
            className="text-display"
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: zoneColor, fontSize: 'clamp(40px, 12vw, 72px)', lineHeight: 1, marginBottom: 'var(--space-3)' }}
          >
            {currentVelocity.toFixed(2)}
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>m/s</div>

          {/* Zone bar */}
          <div className="flex items-center justify-center" style={{ padding: 'var(--space-3)', backgroundColor: `${zoneColor}15`, borderRadius: 'var(--radius-md)', border: `1px solid ${zoneColor}33` }}>
            <span className="text-subheading" style={{ color: zoneColor, fontFamily: 'var(--font-mono)' }}>
              {currentZone === 'IN_RANGE' ? '✓ IN ZONE' : currentZone === 'FAST' ? '↑ TOO FAST' : '↓ TOO SLOW'}
            </span>
          </div>

          {/* Zone range + config button */}
          <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-3)' }}>
            <span className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Target: {lowerBound.toFixed(2)} – {upperBound.toFixed(2)} m/s
            </span>
            <button
              onClick={() => setShowZoneConfig(true)}
              style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', color: 'var(--color-text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
            >
              EDIT
            </button>
          </div>
        </div>
      )}

      {/* Zone config modal */}
      {showZoneConfig && (
        <ZoneConfigPanel
          zoneConfig={zoneConfig}
          onSave={(config) => { setZoneConfig(config); setShowZoneConfig(false); }}
          onClose={() => setShowZoneConfig(false)}
        />
      )}
    </div>
  );
}
