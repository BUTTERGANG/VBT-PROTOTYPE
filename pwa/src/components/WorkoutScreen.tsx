import { useState } from 'react';
import type { Rep } from '../types';

export interface WorkoutSet {
  id: string;
  exercise: string;
  weight: number;
  reps: Rep[];
  avgVelocity: number;
  bestVelocity: number;
  timestamp: number;
}

interface WorkoutScreenProps {
  initialSets: WorkoutSet[];
  onFinish: (sets: WorkoutSet[]) => void;
  onAddSet: () => void;
  onUploadSet?: () => void;
}

const QUICK_WEIGHTS = [2.5, 5, 10, 20];

export function WorkoutScreen({ initialSets, onFinish, onAddSet, onUploadSet }: WorkoutScreenProps) {
  const [sets, setSets] = useState<WorkoutSet[]>(initialSets);
  const [showProfile, setShowProfile] = useState(false);

  const totalReps = sets.reduce((sum, s) => sum + s.reps.length, 0);
  const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps.length, 0);
  const exercises = [...new Set(sets.map(s => s.exercise))];

  const updateSetWeight = (id: string, delta: number) => {
    setSets(prev => prev.map(s =>
      s.id === id ? { ...s, weight: Math.max(0, Math.round((s.weight + delta) * 10) / 10) } : s
    ));
  };

  const removeSet = (id: string) => {
    setSets(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '140px' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-heading page-title">Workout</h1>
          <div className="text-caption page-subtitle">
            {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {totalReps} reps · {totalVolume.toLocaleString()} kg volume
          </div>
        </div>
      </div>

      {/* Exercise summary chips */}
      {exercises.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {exercises.map(ex => {
              const exSets = sets.filter(s => s.exercise === ex);
              const exReps = exSets.reduce((sum, s) => sum + s.reps.length, 0);
              return (
                <div key={ex} style={{
                  padding: '4px 10px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {ex} · {exSets.length}×{exReps}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sets list */}
      {sets.map((set, index) => (
        <div key={set.id} className="card" style={{ marginBottom: 'var(--space-3)' }}>
          {/* Set header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-brand)', color: '#000',
                fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                {index + 1}
              </span>
              <span className="text-body-sm" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {set.exercise}
              </span>
            </div>
            <button
              onClick={() => removeSet(set.id)}
              title="Remove set"
              style={{
                background: 'none', border: 'none',
                color: 'var(--color-text-faint)', fontSize: '16px',
                cursor: 'pointer', padding: '4px 6px', lineHeight: 1,
                borderRadius: 'var(--radius-sm)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-faint)')}
            >
              ×
            </button>
          </div>

          {/* Weight row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <input
              type="number"
              value={set.weight || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setSets(prev => prev.map(s => s.id === set.id ? { ...s, weight: val } : s));
              }}
              className="app-input mono"
              style={{ width: '80px', textAlign: 'center', padding: 'var(--space-2)', fontSize: '18px' }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>kg</span>
            <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {QUICK_WEIGHTS.map(w => (
                <button
                  key={w}
                  onClick={() => updateSetWeight(set.id, w)}
                  style={{
                    padding: '5px 8px', minHeight: '32px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-muted)',
                    fontSize: '12px', cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                >
                  +{w}
                </button>
              ))}
              <button
                onClick={() => updateSetWeight(set.id, -2.5)}
                style={{
                  padding: '5px 8px', minHeight: '32px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-danger)',
                  fontSize: '12px', cursor: 'pointer',
                  opacity: 0.7, transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
              >
                −2.5
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
            {[
              { label: 'Reps', value: String(set.reps.length) },
              { label: 'Avg', value: `${set.avgVelocity.toFixed(2)} m/s` },
              { label: 'Best', value: `${set.bestVelocity.toFixed(2)} m/s` },
              { label: 'Power', value: `${(set.weight * set.avgVelocity).toFixed(0)} W` },
            ].map(stat => (
              <div key={stat.label}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginRight: '4px' }}>
                  {stat.label}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* Rep chart — taller now */}
          <div className="rep-chart" style={{ height: '52px', marginTop: 'var(--space-1)' }}>
            {set.reps.map((rep, i) => {
              const maxV = set.bestVelocity || 1;
              const h = Math.max((rep.meanVelocity / maxV) * 100, 4);
              const color = rep.zoneResult === 'IN_RANGE' ? 'var(--zone-in-range)' : rep.zoneResult === 'FAST' ? 'var(--zone-fast)' : 'var(--zone-slow)';
              return <div key={i} className="rep-chart-bar" style={{ height: `${h}%`, backgroundColor: color }} />;
            })}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {sets.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No sets recorded yet</div>
        </div>
      )}

      {/* Add set buttons */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={onAddSet} className="btn btn-pill btn-brand" style={{ flex: 1 }}>
            + Record Set
          </button>
          <button onClick={() => onUploadSet?.()} className="btn btn-pill btn-secondary" style={{ flex: 1 }}>
            + Upload Video
          </button>
        </div>
      </div>

      {/* Load-Velocity Profile toggle */}
      {sets.length >= 2 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: 'var(--color-text-secondary)', fontSize: '13px',
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
              textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{showProfile ? '▼' : '▶'}</span>
            Load-Velocity Profile
          </button>
          {showProfile && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <LoadVelocityProfile sets={sets} />
            </div>
          )}
        </div>
      )}

      {/* Finish button — sits above tab bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: 'var(--space-3)',
        paddingBottom: 'calc(var(--space-3) + env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 45,
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <button
            onClick={() => onFinish(sets)}
            className="btn btn-pill home-cta-primary"
            style={{ width: '100%' }}
            disabled={sets.length === 0}
          >
            Finish Workout
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadVelocityProfile({ sets }: { sets: WorkoutSet[] }) {
  const padding = 32;
  const chartWidth = 300;
  const chartHeight = 150;

  const weights = sets.map(s => s.weight);
  const velocities = sets.map(s => s.avgVelocity);
  const minW = Math.min(...weights) * 0.9;
  const maxW = Math.max(...weights) * 1.1;
  const maxV = Math.max(...velocities) * 1.2;

  const toX = (w: number) => padding + ((w - minW) / (maxW - minW)) * (chartWidth - padding * 2);
  const toY = (v: number) => chartHeight - padding - (v / maxV) * (chartHeight - padding * 2);

  return (
    <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: 'block' }}>
      <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="var(--color-border)" strokeWidth={1} />
      <text x={10} y={padding} fill="var(--color-text-muted)" fontSize={9} fontFamily="var(--font-mono)">m/s</text>
      <text x={chartWidth - padding - 12} y={chartHeight - 8} fill="var(--color-text-muted)" fontSize={9} fontFamily="var(--font-mono)">kg</text>
      {sets.length >= 2 && (
        <line
          x1={toX(sets[0].weight)} y1={toY(sets[0].avgVelocity)}
          x2={toX(sets[sets.length - 1].weight)} y2={toY(sets[sets.length - 1].avgVelocity)}
          stroke="var(--color-brand)" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
        />
      )}
      {sets.map((set, i) => (
        <g key={i}>
          <circle cx={toX(set.weight)} cy={toY(set.avgVelocity)} r={5} fill="var(--color-brand)" opacity={0.9} />
          <text x={toX(set.weight)} y={toY(set.avgVelocity) - 9} fill="var(--color-text-muted)" fontSize={8} textAnchor="middle" fontFamily="var(--font-mono)">
            {set.weight}kg
          </text>
        </g>
      ))}
    </svg>
  );
}
