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

  const velColor =
    currentZone === 'FAST' ? 'var(--zone-fast)' :
    currentZone === 'IN_RANGE' ? 'var(--zone-in-range)' : 'var(--zone-slow)';

  const lowerBound = zoneConfig.targetVelocity - zoneConfig.tolerance;
  const upperBound = zoneConfig.targetVelocity + zoneConfig.tolerance;

  const dotClass = bleState === 'connected' ? 'connected' : bleState === 'error' ? 'error' : 'idle';

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-heading page-title">Live Lift</h1>
          <div className="text-caption page-subtitle">BLE velocity mirror</div>
        </div>
        <div className="ble-status">
          {bleState === 'connecting' && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
          <div className={`ble-dot ${dotClass}`} />
          <span
            className="text-mono"
            style={{
              fontSize: '11px',
              color: bleState === 'connected' ? 'var(--zone-in-range)' : 'var(--color-text-muted)',
              fontWeight: bleState === 'connected' ? 700 : 400,
            }}
          >
            {bleState === 'connected' ? 'LIVE' : bleState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Error state */}
      {bleState === 'error' && (
        <div className="card card-error" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
          <div className="text-body-sm" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
            Connection failed
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Make sure your VBT device is powered on and in range. Web Bluetooth requires Chrome on Android or desktop.
          </div>
          <button
            onClick={() => bleManager.scanAndConnect()}
            className="btn btn-pill btn-brand"
            style={{ padding: 'var(--space-2) var(--space-5)', fontSize: '13px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Connecting state */}
      {bleState === 'connecting' && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-4)', width: '28px', height: '28px', borderWidth: '3px' }} />
          <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>Scanning for device…</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
            Make sure your VBT sensor is powered on
          </div>
        </div>
      )}

      {/* Idle / not connected */}
      {bleState !== 'connected' && bleState !== 'connecting' && bleState !== 'error' && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-4)', opacity: 0.5 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
              <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>
            </svg>
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
            Connect your VBT device
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)', maxWidth: '280px', margin: '0 auto var(--space-5)' }}>
            Web Bluetooth requires Chrome on Android or desktop. For iPhone, use Camera Mode instead.
          </div>
          <button
            onClick={() => bleManager.scanAndConnect()}
            className="btn btn-pill home-cta-primary"
            style={{ marginBottom: 'var(--space-2)' }}
          >
            Scan for Device
          </button>
          <div>
            <button
              onClick={() => navigate('/camera')}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Or use Camera Mode →
            </button>
          </div>
        </div>
      )}

      {/* Live velocity display */}
      {bleState === 'connected' && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-8)',
            border: `1px solid ${velColor}40`,
            boxShadow: `0 0 32px ${velColor}15`,
          }}
        >
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px', letterSpacing: '1px' }}>
            LIVE VELOCITY
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: velColor, fontSize: 'clamp(48px, 14vw, 80px)',
              lineHeight: 1, marginBottom: 'var(--space-2)',
              transition: 'color 0.1s',
            }}
          >
            {currentVelocity.toFixed(2)}
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>m/s</div>

          {/* Zone indicator */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: `${velColor}12`,
            borderRadius: 'var(--radius-pill)',
            border: `1px solid ${velColor}30`,
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: velColor }} />
            <span style={{ fontFamily: 'var(--font-mono)', color: velColor, fontWeight: 700, fontSize: '14px' }}>
              {currentZone === 'IN_RANGE' ? 'IN ZONE' : currentZone === 'FAST' ? 'TOO FAST' : 'TOO SLOW'}
            </span>
          </div>

          {/* Zone range */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
            <span className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Target {lowerBound.toFixed(2)} – {upperBound.toFixed(2)} m/s
            </span>
            <button
              onClick={() => setShowZoneConfig(true)}
              style={{
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', padding: '3px 10px',
                color: 'var(--color-text-muted)', fontSize: '10px',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              EDIT ZONE
            </button>
          </div>
        </div>
      )}

      {showZoneConfig && (
        <ZoneConfigPanel
          zoneConfig={zoneConfig}
          onSave={config => { setZoneConfig(config); setShowZoneConfig(false); }}
          onClose={() => setShowZoneConfig(false)}
        />
      )}
    </div>
  );
}
