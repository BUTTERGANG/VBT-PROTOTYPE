import { useState } from 'react';
import { useLiftStore } from '../store/liftStore';

export function SettingsScreen() {
  const { zoneConfig, setZoneConfig, visionSettings, updateVisionSettings } = useLiftStore();

  const [targetVel, setTargetVel] = useState(String(zoneConfig.targetVelocity));
  const [tolerance, setTolerance] = useState(String(zoneConfig.tolerance));
  const [plateDiam, setPlateDiam] = useState(String(visionSettings.plateDiameterMm / 10));
  const [recordingEnabled, setRecordingEnabled] = useState(visionSettings.recordingEnabled);
  const [zoneSaved, setZoneSaved] = useState(false);
  const [cameraSaved, setCameraSaved] = useState(false);
  const [zoneError, setZoneError] = useState('');

  const handleSaveZone = () => {
    const tv = parseFloat(targetVel);
    const tol = parseFloat(tolerance);
    if (!tv || tv <= 0 || !tol || tol <= 0) {
      setZoneError('Both values must be greater than 0');
      return;
    }
    setZoneError('');
    setZoneConfig({ targetVelocity: tv, tolerance: tol });
    setZoneSaved(true);
    setTimeout(() => setZoneSaved(false), 2000);
  };

  const handleSaveCamera = () => {
    const pd = parseFloat(plateDiam);
    if (pd > 0) {
      updateVisionSettings({ plateDiameterMm: pd * 10, recordingEnabled });
      setCameraSaved(true);
      setTimeout(() => setCameraSaved(false), 2000);
    }
  };

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      <div className="page-header">
        <h2 className="text-heading page-title">Settings</h2>
      </div>

      {/* Default velocity zone */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', fontSize: '11px' }}>
          DEFAULT VELOCITY ZONE
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="app-label">Target (m/s)</label>
            <input
              type="number" step="0.01" value={targetVel}
              onChange={(e) => { setTargetVel(e.target.value); setZoneError(''); }}
              className="app-input mono"
            />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="app-label">Tolerance (±m/s)</label>
            <input
              type="number" step="0.01" value={tolerance}
              onChange={(e) => { setTolerance(e.target.value); setZoneError(''); }}
              className="app-input mono"
            />
          </div>
        </div>

        {zoneError && (
          <div className="text-caption" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            {zoneError}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Current: {zoneConfig.targetVelocity.toFixed(2)} ± {zoneConfig.tolerance.toFixed(2)} m/s
          </div>
          <button
            onClick={handleSaveZone}
            className="btn btn-pill btn-brand"
            style={{ padding: 'var(--space-2) var(--space-5)', fontSize: '13px' }}
          >
            {zoneSaved ? '✓ Saved' : 'Save Zone'}
          </button>
        </div>
      </div>

      {/* Camera settings */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', fontSize: '11px' }}>CAMERA</div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="app-label">Plate Diameter (cm)</label>
          <input
            type="number" step="1" value={plateDiam}
            onChange={(e) => setPlateDiam(e.target.value)}
            className="app-input mono"
          />
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Used for scale calibration. Standard Olympic plate: 45cm
          </div>
        </div>

        {/* Custom toggle */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label className="toggle-row" onClick={() => setRecordingEnabled(v => !v)}>
            <span className="toggle">
              <input
                type="checkbox"
                checked={recordingEnabled}
                onChange={(e) => setRecordingEnabled(e.target.checked)}
              />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </span>
            <div>
              <div className="text-body-sm" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Record video during sets
              </div>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Saves video for post-set review with bar path overlay
              </div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSaveCamera}
            className="btn btn-pill btn-brand"
            style={{ padding: 'var(--space-2) var(--space-5)', fontSize: '13px' }}
          >
            {cameraSaved ? '✓ Saved' : 'Save Camera'}
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>ABOUT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>Version</span>
            <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>1.0.0</span>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
            <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
              Camera-first velocity based training. Markerless detection via MediaPipe pose + barbell contour analysis. No hardware required.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
