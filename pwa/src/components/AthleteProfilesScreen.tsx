// src/components/AthleteProfilesScreen.tsx

import { useState, useEffect } from 'react';
import { api } from '../services/api/client';
import type { Athlete } from '../types';

interface AthleteProfilesScreenProps {
  onSelectAthlete?: (athleteId: string) => void;
}

export function AthleteProfilesScreen({ onSelectAthlete }: AthleteProfilesScreenProps) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [formData, setFormData] = useState({ name: '', bodyweight: '', primaryLifts: '', baselineVelocity: '', fatigueThreshold: '0.15' });

  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      const data = await api.getAthletes();
      setAthletes(data);
    } catch (err) {
      console.error('Failed to load athletes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        bodyweight: formData.bodyweight ? parseFloat(formData.bodyweight) : null,
        primary_lifts: formData.primaryLifts ? formData.primaryLifts.split(',').map((s: string) => s.trim()) : [],
        baseline_velocity: formData.baselineVelocity ? parseFloat(formData.baselineVelocity) : null,
        fatigue_threshold: parseFloat(formData.fatigueThreshold) || 0.15,
      };

      if (editingAthlete) {
        await api.updateAthlete(editingAthlete.id, payload);
      } else {
        await api.createAthlete(payload);
      }

      setShowForm(false);
      setEditingAthlete(null);
      setFormData({ name: '', bodyweight: '', primaryLifts: '', baselineVelocity: '', fatigueThreshold: '0.15' });
      loadAthletes();
    } catch (err) {
      console.error('Failed to save athlete:', err);
    }
  };

  const handleEdit = (athlete: Athlete) => {
    setEditingAthlete(athlete);
    setFormData({
      name: athlete.name,
      bodyweight: athlete.bodyweight?.toString() || '',
      primaryLifts: athlete.primaryLifts.join(', '),
      baselineVelocity: athlete.baselineVelocity?.toString() || '',
      fatigueThreshold: athlete.fatigueThreshold?.toString() || '0.15',
    });
    setShowForm(true);
  };


  if (showForm) {
    return (
      <div className="screen-container" style={{ paddingBottom: '80px' }}>
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)' }}>
            <h2 className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
              {editingAthlete ? 'Edit Athlete' : 'New Athlete'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingAthlete(null); }}
              className="btn btn-ghost"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Athlete name"
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                  Bodyweight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.bodyweight}
                  onChange={(e) => setFormData({ ...formData, bodyweight: e.target.value })}
                  placeholder="75.0"
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
                  Baseline Velocity (m/s)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.baselineVelocity}
                  onChange={(e) => setFormData({ ...formData, baselineVelocity: e.target.value })}
                  placeholder="0.45"
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

            <div>
              <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Primary Lifts (comma-separated)
              </label>
              <input
                type="text"
                value={formData.primaryLifts}
                onChange={(e) => setFormData({ ...formData, primaryLifts: e.target.value })}
                placeholder="Squat, Bench, Deadlift"
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label className="text-caption" style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                Fatigue Threshold (%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="0.50"
                value={formData.fatigueThreshold}
                onChange={(e) => setFormData({ ...formData, fatigueThreshold: e.target.value })}
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
                Velocity drop that triggers fatigue alert (e.g. 0.15 = 15%)
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: 'var(--space-2)' }}>
              <button
                onClick={handleSubmit}
                className="btn btn-pill btn-brand"
                style={{ flex: 1, padding: 'var(--space-3)' }}
                disabled={!formData.name.trim()}
              >
                {editingAthlete ? 'Save Changes' : 'Create Athlete'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingAthlete(null); }}
                className="btn btn-pill btn-secondary"
                style={{ padding: 'var(--space-3) var(--space-5)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        <h2 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>Athletes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-pill btn-brand"
          style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '13px' }}
        >
          + Add
        </button>
      </div>

      {/* Athlete list */}
      {athletes.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>🏋️</div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No athletes yet</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Add athletes to track their VBT data
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {athletes.map((athlete: any) => (
            <div
              key={athlete.id}
              className="card"
              style={{ padding: 'var(--space-4)', cursor: 'pointer' }}
              onClick={() => onSelectAthlete?.(athlete.id)}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                <div className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                  {athlete.name}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(athlete); }}
                  className="btn btn-ghost"
                  style={{ color: 'var(--color-text-muted)', padding: 'var(--space-1)' }}
                >
                  ✏️
                </button>
              </div>

              <div className="flex gap-4" style={{ marginBottom: 'var(--space-2)' }}>
                {athlete.bodyweight && (
                  <div>
                    <span className="text-mono" style={{ color: 'var(--color-brand)' }}>{athlete.bodyweight}</span>
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>kg</span>
                  </div>
                )}
                {athlete.baseline_velocity && (
                  <div>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)' }}>{athlete.baseline_velocity}</span>
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>m/s baseline</span>
                  </div>
                )}
              </div>

              {athlete.primary_lifts && athlete.primary_lifts.length > 0 && (
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {athlete.primary_lifts.map((lift: string) => (
                    <span
                      key={lift}
                      className="text-caption"
                      style={{
                        color: 'var(--color-text-muted)',
                        backgroundColor: 'var(--color-bg)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                      }}
                    >
                      {lift}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
          <span className="text-caption">Loading athletes...</span>
        </div>
      )}
    </div>
  );
}
