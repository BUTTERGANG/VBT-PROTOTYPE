// src/components/WorkoutScreen.tsx

import { useState } from 'react';
import type { Rep } from '../types';

/**
 * Workout screen -- multi-set builder.
 *
 * Shows recorded sets, allows adding more sets/exercises,
 * quick weight input, and load-velocity profile chart.
 */
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
  onAddSet: () => void; // Navigate back to camera to record another set
  onUploadSet?: () => void; // Navigate to camera upload mode
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
      s.id === id ? { ...s, weight: Math.max(0, s.weight + delta) } : s
    ));
  };

  const removeSet = (id: string) => {
    setSets(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '100px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Workout
          </h1>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {sets.length} sets · {totalReps} reps · {totalVolume.toLocaleString()}kg volume
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {exercises.map(ex => {
            const exSets = sets.filter(s => s.exercise === ex);
            const exReps = exSets.reduce((sum, s) => sum + s.reps.length, 0);
            return (
              <div key={ex} style={{ padding: '4px 8px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {ex}: {exSets.length} sets × {exReps} reps
              </div>
            );
          })}
        </div>
      </div>

      {/* Sets list */}
      {sets.map((set, index) => (
        <div key={set.id} className="card" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
              SET {index + 1} · {set.exercise}
            </div>
            <button
              onClick={() => removeSet(set.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Weight with quick-add */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <input
              type="number"
              value={set.weight || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setSets(prev => prev.map(s => s.id === set.id ? { ...s, weight: val } : s));
              }}
              style={{
                width: '80px',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontSize: '16px',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
              }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>kg</span>
            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              {QUICK_WEIGHTS.map(w => (
                <button
                  key={w}
                  onClick={() => updateSetWeight(set.id, w)}
                  style={{
                    padding: '2px 8px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-muted)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  +{w}
                </button>
              ))}
              <button
                onClick={() => updateSetWeight(set.id, -Math.min(set.weight, QUICK_WEIGHTS[QUICK_WEIGHTS.length - 1]))}
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                −
              </button>
            </div>
          </div>

          {/* Rep summary */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <span>{set.reps.length} reps</span>
            <span>Avg: {set.avgVelocity.toFixed(2)} m/s</span>
            <span>Best: {set.bestVelocity.toFixed(2)} m/s</span>
            <span>Power: {(set.weight * set.avgVelocity).toFixed(0)}W</span>
          </div>

          {/* Mini rep chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '30px', marginTop: 'var(--space-2)' }}>
            {set.reps.map((rep, i) => {
              const maxV = set.bestVelocity || 1;
              const h = (rep.meanVelocity / maxV) * 100;
              const color = rep.zoneResult === 'IN_RANGE' ? '#10b981' : rep.zoneResult === 'FAST' ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} style={{ flex: 1, height: `${h}%`, backgroundColor: color, borderRadius: '1px', minHeight: '2px' }} />
              );
            })}
          </div>
        </div>
      ))}

      {/* Add set buttons */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={onAddSet}
            className="btn btn-pill btn-brand"
            style={{ flex: 1, padding: 'var(--space-3)' }}
          >
            + Record Set
          </button>
          <button
            onClick={() => onUploadSet?.()}
            className="btn btn-pill"
            style={{ flex: 1, padding: 'var(--space-3)' }}
          >
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
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
            }}
          >
            {showProfile ? '▼' : '▶'} Load-Velocity Profile
          </button>

          {showProfile && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              {/* Simple scatter: X = weight, Y = avg velocity */}
              <LoadVelocityProfile sets={sets} />
            </div>
          )}
        </div>
      )}

      {/* Finish button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', zIndex: 50 }}>
        <button
          onClick={() => onFinish(sets)}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-3)' }}
        >
          Finish Workout
        </button>
      </div>
    </div>
  );
}

/**
 * Simple load-velocity profile chart.
 * X-axis: weight (kg), Y-axis: velocity (m/s)
 */
function LoadVelocityProfile({ sets }: { sets: WorkoutSet[] }) {
  const padding = 30;
  const chartWidth = 300;
  const chartHeight = 150;

  const weights = sets.map(s => s.weight);
  const velocities = sets.map(s => s.avgVelocity);
  const minW = Math.min(...weights) * 0.9;
  const maxW = Math.max(...weights) * 1.1;
  const minV = 0;
  const maxV = Math.max(...velocities) * 1.2;

  const toX = (w: number) => padding + ((w - minW) / (maxW - minW)) * (chartWidth - padding * 2);
  const toY = (v: number) => chartHeight - padding - ((v - minV) / (maxV - minV)) * (chartHeight - padding * 2);

  return (
    <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
      {/* Axes */}
      <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="var(--color-border)" strokeWidth={1} />

      {/* Y label */}
      <text x={8} y={padding - 5} fill="var(--color-text-muted)" fontSize={8} fontFamily="var(--font-mono)">m/s</text>

      {/* X label */}
      <text x={chartWidth - padding - 15} y={chartHeight - 8} fill="var(--color-text-muted)" fontSize={8} fontFamily="var(--font-mono)">kg</text>

      {/* Data points */}
      {sets.map((set, i) => (
        <g key={i}>
          <circle cx={toX(set.weight)} cy={toY(set.avgVelocity)} r={4} fill="var(--color-brand)" />
          <text x={toX(set.weight)} y={toY(set.avgVelocity) - 8} fill="var(--color-text-muted)" fontSize={8} textAnchor="middle">
            {set.weight}kg
          </text>
        </g>
      ))}

      {/* Trend line (simple linear) */}
      {sets.length >= 2 && (
        <line
          x1={toX(sets[0].weight)}
          y1={toY(sets[0].avgVelocity)}
          x2={toX(sets[sets.length - 1].weight)}
          y2={toY(sets[sets.length - 1].avgVelocity)}
          stroke="var(--color-brand)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.5}
        />
      )}
    </svg>
  );
}
