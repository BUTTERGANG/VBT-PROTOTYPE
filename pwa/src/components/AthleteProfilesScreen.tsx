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

  useEffect(() => { loadAthletes(); }, []);

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

  const closeForm = () => { setShowForm(false); setEditingAthlete(null); };

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Form modal — overlays list with backdrop */}
      {showForm && (
        <>
          <div onClick={closeForm} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', inset: '0 0 auto 0', zIndex: 11, padding: 'var(--space-4)', maxWidth: '520px', margin: '0 auto', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                <h2 className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                  {editingAthlete ? 'Edit Athlete' : 'New Athlete'}
                </h2>
                <button onClick={closeForm} className="btn btn-ghost" style={{ color: 'var(--color-text-muted)', minHeight: '36px', padding: 'var(--space-1) var(--space-2)' }}>
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label className="app-label">Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Athlete name" className="app-input" />
                </div>

                {/* Responsive two-column row */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <label className="app-label">Bodyweight (kg)</label>
                    <input type="number" step="0.1" value={formData.bodyweight} onChange={e => setFormData({ ...formData, bodyweight: e.target.value })} placeholder="75.0" className="app-input mono" />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label className="app-label">Baseline Velocity (m/s)</label>
                    <input type="number" step="0.01" value={formData.baselineVelocity} onChange={e => setFormData({ ...formData, baselineVelocity: e.target.value })} placeholder="0.45" className="app-input mono" />
                  </div>
                </div>

                <div>
                  <label className="app-label">Primary Lifts</label>
                  <input type="text" value={formData.primaryLifts} onChange={e => setFormData({ ...formData, primaryLifts: e.target.value })} placeholder="Squat, Bench, Deadlift" className="app-input" />
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>Comma-separated list</div>
                </div>

                <div>
                  <label className="app-label">Fatigue Threshold</label>
                  <input type="number" step="0.05" min="0.05" max="0.50" value={formData.fatigueThreshold} onChange={e => setFormData({ ...formData, fatigueThreshold: e.target.value })} className="app-input mono" />
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                    Velocity drop % that triggers a fatigue alert (e.g. 0.15 = 15%)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-1)' }}>
                  <button onClick={handleSubmit} className="btn btn-pill btn-brand" style={{ flex: 1 }} disabled={!formData.name.trim()}>
                    {editingAthlete ? 'Save Changes' : 'Create Athlete'}
                  </button>
                  <button onClick={closeForm} className="btn btn-pill btn-secondary" style={{ padding: 'var(--space-2) var(--space-5)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* List view header */}
      <div className="page-header">
        <h2 className="text-heading page-title">Athletes</h2>
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
          <div style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No athletes yet</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Add athletes to track their VBT data
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {athletes.map((athlete: any) => (
            <div
              key={athlete.id}
              className="card"
              style={{ padding: 'var(--space-4)', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
              onClick={() => onSelectAthlete?.(athlete.id)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-mid)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: 'rgba(62,207,142,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-brand)', fontWeight: 700, fontSize: '14px',
                    fontFamily: 'var(--font-mono)', flexShrink: 0,
                  }}>
                    {athlete.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-body" style={{ color: 'var(--color-text-primary)', fontWeight: 600, margin: 0 }}>
                    {athlete.name}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleEdit(athlete); }}
                  className="btn btn-ghost"
                  style={{ color: 'var(--color-text-muted)', minHeight: '36px', padding: 'var(--space-1) var(--space-2)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: athlete.primary_lifts?.length ? 'var(--space-3)' : 0 }}>
                {athlete.bodyweight && (
                  <div>
                    <span className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '15px', fontWeight: 700 }}>{athlete.bodyweight}</span>
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>kg</span>
                  </div>
                )}
                {athlete.baseline_velocity && (
                  <div>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '15px', fontWeight: 600 }}>{athlete.baseline_velocity}</span>
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>m/s baseline</span>
                  </div>
                )}
              </div>

              {athlete.primary_lifts?.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {athlete.primary_lifts.map((lift: string) => (
                    <span key={lift} className="text-caption" style={{
                      color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)',
                      padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-subtle)',
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                    }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
