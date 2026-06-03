// src/components/SetReviewScreen.tsx

import { useRef, useEffect } from 'react';
import type { VelocityReading, Rep } from '../types';

/**
 * Set Review screen - shown after a set is completed.
 *
 * Displays:
 * - Video playback with bar path trace overlay
 * - Rep-by-rep table (mean velocity, ROM, eccentric tempo)
 * - Summary stats (best/avg/loss/vs last set)
 * - Velocity chart through set
 * - Save/discard + start workout option
 */
export interface SetReviewData {
  exercise: string;
  weight: number;
  reps: Rep[];
  readings: VelocityReading[];
  /** Object URL for video playback */
  videoUrl: string | null;
  /** Bar path positions for overlay */
  barPath: Array<{ x: number; y: number }>;
  /** Previous set data for comparison (if available) */
  prevSet?: {
    avgVelocity: number;
    bestVelocity: number;
    weight: number;
  };
}

interface SetReviewScreenProps {
  data: SetReviewData;
  onSave: () => void;
  onDiscard: () => void;
  onStartWorkout: () => void;
}

export function SetReviewScreen({ data, onSave, onDiscard, onStartWorkout }: SetReviewScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { exercise, weight, reps, videoUrl, barPath, prevSet } = data;

  // Compute stats
  const totalReps = reps.length;
  const velocities = reps.map(r => r.meanVelocity);
  const bestVelocity = totalReps > 0 ? Math.max(...velocities) : 0;
  const avgVelocity = totalReps > 0 ? velocities.reduce((a, b) => a + b, 0) / totalReps : 0;
  const firstRepVelocity = totalReps > 0 ? velocities[0] : 0;
  const velocityLoss = firstRepVelocity > 0 ? ((firstRepVelocity - velocities[velocities.length - 1]) / firstRepVelocity) : 0;
  const vsLastSet = prevSet ? avgVelocity - prevSet.avgVelocity : null;

  const repsInZone = reps.filter(r => r.zoneResult === 'IN_RANGE').length;
  const zonePct = totalReps > 0 ? Math.round((repsInZone / totalReps) * 100) : 0;

  // MRS (Minimum Rep Speed) = last rep's velocity
  const mrs = totalReps > 0 ? velocities[velocities.length - 1] : 0;
  const pctOfPB = prevSet && prevSet.weight > 0 ? (weight / prevSet.weight) * 100 : null;

  // Draw bar path overlay on video
  useEffect(() => {
    if (!canvasRef.current || barPath.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (barPath.length > 1) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(barPath[0].x, barPath[0].y);
        for (let i = 1; i < barPath.length; i++) {
          ctx.lineTo(barPath[i].x, barPath[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      requestAnimationFrame(draw);
    };
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [barPath]);

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '80px', overflowY: 'auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
            Set Review
          </h1>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {exercise} — {weight}kg × {totalReps} reps
          </div>
        </div>
      </div>

      {/* Video playback */}
      {videoUrl && (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)', margin: '0 auto var(--space-4)' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#1a1a1a',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
          Velocity
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 'var(--space-3)' }}>
          <StatBox label="BEST" value={bestVelocity.toFixed(2)} unit="m/s" color="#10b981" />
          <StatBox label="AVG" value={avgVelocity.toFixed(2)} unit="m/s" color="var(--color-brand)" />
          <StatBox label="LOSS" value={`${(velocityLoss * 100).toFixed(0)}%`} unit="" color={velocityLoss > 0.2 ? '#ef4444' : '#6b7280'} />
        </div>
        {vsLastSet !== null && (
          <div className="text-caption" style={{ color: vsLastSet >= 0 ? '#10b981' : '#ef4444' }}>
            vs last set: {vsLastSet >= 0 ? '+' : ''}{vsLastSet.toFixed(3)} m/s
          </div>
        )}
      </div>

      {/* Badges row */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Badge label={`${weight}kg`} icon="🏋" />
          <Badge label={`${totalReps} reps`} icon="🔥" />
          <Badge label={`${avgVelocity.toFixed(2)} m/s`} icon="⚡" />
          <Badge label={`${(weight * avgVelocity).toFixed(0)}W`} icon="💪" />
          <Badge label={`MRS ${mrs.toFixed(2)}`} icon="📊" />
          {pctOfPB !== null && <Badge label={`${pctOfPB.toFixed(0)}% of PB`} icon="🏆" />}
        </div>
      </div>

      {/* Zone adherence */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
          ZONE ADHERENCE
        </div>
        <div className="flex" style={{ height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
          <div style={{ width: `${zonePct}%`, backgroundColor: '#10b981' }} />
          <div style={{ width: `${100 - zonePct}%`, backgroundColor: '#6b7280' }} />
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          {repsInZone} of {totalReps} reps in zone ({zonePct}%)
        </div>
      </div>

      {/* Velocity chart (mini bar chart per rep) */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          VELOCITY PER REP
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
          {velocities.map((v, i) => {
            const maxV = bestVelocity || 1;
            const heightPct = (v / maxV) * 100;
            const zone = reps[i]?.zoneResult;
            const color = zone === 'IN_RANGE' ? '#10b981' : zone === 'FAST' ? '#f59e0b' : '#ef4444';
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ width: '100%', height: `${heightPct}%`, backgroundColor: color, borderRadius: '2px 2px 0 0', minHeight: '4px' }} />
                <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rep-by-rep table */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          REP DETAILS
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: 'var(--space-2)' }}>Rep</th>
                <th style={{ padding: 'var(--space-2)' }}>Mean Vel</th>
                <th style={{ padding: 'var(--space-2)' }}>Peak Vel</th>
                <th style={{ padding: 'var(--space-2)' }}>Zone</th>
                <th style={{ padding: 'var(--space-2)' }}>e1RM</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep, i) => {
                const zoneColor = rep.zoneResult === 'IN_RANGE' ? '#10b981' : rep.zoneResult === 'FAST' ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={i} style={{ color: 'var(--color-text-primary)' }}>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.repNumber}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.meanVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.peakVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <span style={{ color: zoneColor, backgroundColor: `${zoneColor}15`, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        {rep.zoneResult === 'IN_RANGE' ? 'IN ZONE' : rep.zoneResult}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {rep.estimated1rm ? `${rep.estimated1rm.toFixed(0)}kg` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button onClick={onSave} className="btn btn-pill btn-brand" style={{ width: '100%', padding: 'var(--space-3)' }}>
            Save Set
          </button>
          <button onClick={onStartWorkout} className="btn btn-pill" style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-brand)', color: 'var(--color-brand)' }}>
            Start Workout
          </button>
          <button onClick={onDiscard} className="btn btn-pill" style={{ width: '100%', padding: 'var(--space-3)', color: '#ef4444' }}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
      <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div className="text-mono" style={{ color, fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      {unit && <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{unit}</div>}
    </div>
  );
}

function Badge({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
