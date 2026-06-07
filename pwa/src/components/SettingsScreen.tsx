// src/components/SettingsScreen.tsx

import { useState } from 'react';
import { useLiftStore } from '../store/liftStore';

/**
 * Settings screen — athlete defaults, zone config, camera preferences.
 */
export function SettingsScreen() {
  const { zoneConfig, setZoneConfig, visionSettings, updateVisionSettings } = useLiftStore();

  const [targetVel, setTargetVel] = useState(String(zoneConfig.targetVelocity));
  const [tolerance, setTolerance] = useState(String(zoneConfig.tolerance));
  const [plateDiam, setPlateDiam] = useState(String(visionSettings.plateDiameterMm));
  const [recordingEnabled, setRecordingEnabled] = useState(visionSettings.recordingEnabled);

  const handleSaveZone = () => {
    const tv = parseFloat(targetVel);
    const tol = parseFloat(tolerance);
    if (tv > 0 && tol > 0) {
      setZoneConfig({ targetVelocity: tv, tolerance: tol });
    }
  };

  const handleSaveCamera = () => {
    const pd = parseFloat(plateDiam);
    if (pd > 0) {
      updateVisionSettings({
        plateDiameterMm: pd,
        recordingEnabled,
      });
    }
  };

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      <div style={{ paddingTop: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <h2 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
          Settings
        </h2>
      </div>

      {/* Zone defaults */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          DEFAULT VELOCITY ZONE
        </div>
        <div className="flex gap-3" style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Target (m/s)
            </label>
            <input
              type="number"
              step="0.01"
              value={targetVel}
              onChange={(e) => setTargetVel(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
              Tolerance (±m/s)
            </label>
            <input
              type="number"
              step="0.01"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
        </div>
        <button
          onClick={handleSaveZone}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-2)', fontSize: '12px' }}
        >
          Save Zone Defaults
        </button>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Current: {zoneConfig.targetVelocity.toFixed(2)} ± {zoneConfig.tolerance.toFixed(2)} m/s
        </div>
      </div>

      {/* Camera settings */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          CAMERA
        </div>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
            Plate Diameter (mm)
          </label>
          <input
            type="number"
            step="10"
            value={plateDiam}
            onChange={(e) => setPlateDiam(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Used for scale calibration. Standard: 450mm (full-size plate)
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <span className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>
              Record video during sets
            </span>
          </label>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', marginLeft: '28px' }}>
            Saves video for post-set review with bar path overlay
          </div>
        </div>

        <button
          onClick={handleSaveCamera}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-2)', fontSize: '12px' }}
        >
          Save Camera Settings
        </button>
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
          ABOUT
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          VBT Tracker v1.0 — Camera-first velocity based training
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
          Markerless detection via MediaPipe pose + barbell contour analysis
        </div>
      </div>
    </div>
  );
}
