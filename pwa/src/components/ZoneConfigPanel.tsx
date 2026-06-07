// src/components/ZoneConfigPanel.tsx

import { useState } from 'react';
import type { ZoneConfig } from '../types';

interface ZoneConfigPanelProps {
  zoneConfig: ZoneConfig;
  onSave: (config: ZoneConfig) => void;
  onClose: () => void;
}

const PRESETS: { label: string; config: ZoneConfig }[] = [
  { label: 'Strength', config: { targetVelocity: 0.45, tolerance: 0.05 } },
  { label: 'Power', config: { targetVelocity: 0.65, tolerance: 0.05 } },
  { label: 'Speed', config: { targetVelocity: 0.85, tolerance: 0.05 } },
  { label: 'Peak', config: { targetVelocity: 1.00, tolerance: 0.08 } },
];

export function ZoneConfigPanel({ zoneConfig, onSave, onClose }: ZoneConfigPanelProps) {
  const [target, setTarget] = useState(zoneConfig.targetVelocity.toString());
  const [tolerance, setTolerance] = useState(zoneConfig.tolerance.toString());
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const t = parseFloat(target);
    const tol = parseFloat(tolerance);
    if (isNaN(t) || t <= 0) {
      setError('Target velocity must be a positive number');
      return;
    }
    if (isNaN(tol) || tol <= 0) {
      setError('Tolerance must be a positive number');
      return;
    }
    if (t > 3.0) {
      setError('Target velocity seems too high (max 3.0 m/s)');
      return;
    }
    if (tol > t) {
      setError('Tolerance cannot be larger than target velocity');
      return;
    }
    setError(null);
    onSave({ targetVelocity: t, tolerance: tol });
    onClose();
  };

  const handlePreset = (config: ZoneConfig) => {
    setTarget(config.targetVelocity.toString());
    setTolerance(config.tolerance.toString());
    setError(null);
  };

  const previewTarget = parseFloat(target) || 0;
  const previewTol = parseFloat(tolerance) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 'var(--space-4)' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '360px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)' }}>
          <h2 className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Zone Settings
          </h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ color: 'var(--color-text-muted)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            PRESETS
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.config)}
                className="btn btn-pill btn-secondary"
                style={{ fontSize: '12px', padding: 'var(--space-2) var(--space-3)' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom values */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            CUSTOM
          </div>
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Target (m/s)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
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
                Tolerance (±)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="0.5"
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
        </div>

        {/* Validation error */}
        {error && (
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #ef4444', fontSize: '12px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* Preview */}
        <div
          className="flex items-center justify-between"
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
          }}
        >
          <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Zone range:</span>
          <span className="text-mono-sm" style={{ color: 'var(--color-brand)' }}>
            {previewTarget > 0 ? `${(previewTarget - previewTol).toFixed(2)} — ${(previewTarget + previewTol).toFixed(2)}` : '—'} m/s
          </span>
        </div>

        <button
          onClick={handleSave}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-3)', fontSize: '14px' }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
