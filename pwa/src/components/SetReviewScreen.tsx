// src/components/SetReviewScreen.tsx

import { useRef, useEffect, useState } from 'react';
import { useLiftStore } from '../store/liftStore';
import { estimate1RM } from '../utils/oneRMCalculator';
import type { VelocityReading, Rep, ZoneResult } from '../types';

/**
 * Set Review screen - shown after a set is completed.
 *
 * Displays:
 * - Video playback with bar path trace overlay
 * - Personal record badges
 * - Rep-by-rep table with false rep removal
 * - Summary stats (best/avg/loss/vs last set, e1RM)
 * - Velocity chart through set
 * - RPE input
 * - Edit set details (exercise, weight)
 */
export interface SetReviewData {
  exercise: string;
  weight: number;
  reps: Rep[];
  readings: VelocityReading[];
  videoUrl: string | null;
  barPath: Array<{ x: number; y: number }>;
  prevSet?: { avgVelocity: number; bestVelocity: number; weight: number };
}

interface SetReviewScreenProps {
  data?: SetReviewData;
  onSave?: () => void;
  onDiscard?: () => void;
  onStartWorkout?: () => void;
}

export function SetReviewScreen({ data, onSave, onDiscard, onStartWorkout }: SetReviewScreenProps) {
  const { completedReps, exercise: storeExercise } = useLiftStore();

  // Use provided data or fall back to liftStore
  const initialExercise = data?.exercise ?? storeExercise;
  const initialWeight = data?.weight ?? 0;
  const initialReps = data?.reps ?? completedReps;
  const videoUrl = data?.videoUrl ?? null;
  const barPath = data?.barPath ?? [];
  const prevSet = data?.prevSet;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Editable state
  const [exercise, setExercise] = useState(initialExercise);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState<Rep[]>(initialReps);
  const [rpe, setRpe] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showBarPath, setShowBarPath] = useState(true);

  // Remove a false rep (setup movement, catch, etc.)
  const removeRep = (index: number) => {
    setReps(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Re-number
      return next.map((r, i) => ({ ...r, repNumber: i + 1 }));
    });
  };

  // Compute stats from current (possibly edited) reps
  const totalReps = reps.length;
  const velocities = reps.map(r => r.meanVelocity);
  const bestVelocity = totalReps > 0 ? Math.max(...velocities) : 0;
  const avgVelocity = totalReps > 0 ? velocities.reduce((a, b) => a + b, 0) / totalReps : 0;
  const firstRepVelocity = totalReps > 0 ? velocities[0] : 0;
  const velocityLoss = firstRepVelocity > 0 ? ((firstRepVelocity - velocities[velocities.length - 1]) / firstRepVelocity) : 0;
  const vsLastSet = prevSet ? avgVelocity - prevSet.avgVelocity : null;
  const repsInZone = reps.filter(r => r.zoneResult === 'IN_RANGE').length;
  const zonePct = totalReps > 0 ? Math.round((repsInZone / totalReps) * 100) : 0;
  const mrs = totalReps > 0 ? velocities[velocities.length - 1] : 0;
  const e1RM = weight > 0 && avgVelocity > 0 ? estimate1RM(weight, avgVelocity, 'M1') : null;

  // Draw bar path overlay on video
  useEffect(() => {
    if (!canvasRef.current || barPath.length === 0 || !showBarPath) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to video
    const video = videoRef.current;
    if (video) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (barPath.length > 1) {
        // Scale bar path to canvas dimensions
        const xs = barPath.map(p => p.x);
        const ys = barPath.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < barPath.length; i++) {
          const px = ((barPath[i].x - minX) / rangeX) * canvas.width * 0.8 + canvas.width * 0.1;
          const py = ((barPath[i].y - minY) / rangeY) * canvas.height * 0.8 + canvas.height * 0.1;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Current position dot
        const last = barPath[barPath.length - 1];
        const lx = ((last.x - minX) / rangeX) * canvas.width * 0.8 + canvas.width * 0.1;
        const ly = ((last.y - minY) / rangeY) * canvas.height * 0.8 + canvas.height * 0.1;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [barPath, showBarPath]);

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
        <button
          onClick={() => setShowEdit(!showEdit)}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '18px' }}
        >
          ✏️
        </button>
      </div>

      {/* Edit set modal */}
      {showEdit && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>EDIT SET</div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>EXERCISE</label>
            <input
              type="text" value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              style={{ width: '100%', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>WEIGHT (kg)</label>
            <input
              type="number" step="0.5" value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', fontFamily: 'var(--font-mono)', outline: 'none' }}
            />
          </div>
          <button onClick={() => setShowEdit(false)} className="btn btn-pill btn-brand" style={{ width: '100%', padding: 'var(--space-2)', fontSize: '12px' }}>Done</button>
        </div>
      )}

      {/* Video playback */}
      {videoUrl && (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', marginBottom: 'var(--space-4)', margin: '0 auto var(--space-4)' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{ width: '100%', borderRadius: 'var(--radius-md)', backgroundColor: '#1a1a1a' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          {/* Bar path toggle */}
          {barPath.length > 0 && (
            <button
              onClick={() => setShowBarPath(!showBarPath)}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.6)',
                border: 'none', borderRadius: '4px', color: showBarPath ? '#10b981' : '#6b7280',
                fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}
            >
              {showBarPath ? '◯ PATH' : '◯ PATH OFF'}
            </button>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-subheading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>Velocity</div>
        <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 'var(--space-3)' }}>
          <StatBox label="BEST" value={bestVelocity.toFixed(2)} unit="m/s" color="#10b981" />
          <StatBox label="AVG" value={avgVelocity.toFixed(2)} unit="m/s" color="var(--color-brand)" />
          <StatBox label="LOSS" value={`${(velocityLoss * 100).toFixed(0)}%`} unit="" color={velocityLoss > 0.2 ? '#ef4444' : '#6b7280'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {e1RM && <StatBox label="e1RM" value={`${e1RM}`} unit="kg" color="#3b82f6" />}
          <StatBox label="POWER" value={`${(weight * avgVelocity).toFixed(0)}`} unit="W" color="#8b5cf6" />
        </div>
        {vsLastSet !== null && (
          <div className="text-caption" style={{ color: vsLastSet >= 0 ? '#10b981' : '#ef4444', marginTop: 'var(--space-2)' }}>
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
          <Badge label={`MRS ${mrs.toFixed(2)}`} icon="📊" />
          {e1RM && <Badge label={`e1RM ${e1RM}kg`} icon="🏆" />}
          {rpe && <Badge label={`RPE ${rpe}`} icon="📝" />}
        </div>
      </div>

      {/* Zone adherence */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>ZONE ADHERENCE</div>
        <div className="flex" style={{ height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
          <div style={{ width: `${zonePct}%`, backgroundColor: '#10b981' }} />
          <div style={{ width: `${100 - zonePct}%`, backgroundColor: '#6b7280' }} />
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          {repsInZone} of {totalReps} reps in zone ({zonePct}%)
        </div>
      </div>

      {/* RPE input */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>RPE (Rate of Perceived Exertion)</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(val => (
            <button
              key={val}
              onClick={() => setRpe(val === rpe ? null : val)}
              style={{
                padding: '4px 10px', borderRadius: '999px',
                border: `1px solid ${rpe === val ? 'var(--color-brand)' : 'var(--color-border)'}`,
                backgroundColor: rpe === val ? 'var(--color-brand)' : 'transparent',
                color: rpe === val ? '#000' : 'var(--color-text-muted)',
                fontSize: '12px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Velocity chart */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>VELOCITY PER REP</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
          {velocities.map((v, i) => {
            const maxV = bestVelocity || 1;
            const heightPct = (v / maxV) * 100;
            const zone: ZoneResult = reps[i]?.zoneResult || 'SLOW';
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

      {/* Rep-by-rep table with false rep removal */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>REP DETAILS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: 'var(--space-2)' }}></th>
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
                const repE1RM = weight > 0 ? estimate1RM(weight, rep.meanVelocity, 'M1') : null;
                return (
                  <tr key={i} style={{ color: 'var(--color-text-primary)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <button
                        onClick={() => removeRep(i)}
                        title="Remove false rep"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '0 2px' }}
                      >
                        −
                      </button>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.repNumber}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.meanVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.peakVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <span style={{ color: zoneColor, backgroundColor: `${zoneColor}15`, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        {rep.zoneResult === 'IN_RANGE' ? 'IN ZONE' : rep.zoneResult}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      {repE1RM ? `${repE1RM}kg` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalReps < initialReps.length && (
          <div className="text-caption" style={{ color: '#f59e0b', marginTop: 'var(--space-2)' }}>
            {initialReps.length - totalReps} rep(s) removed — stats recalculated
          </div>
        )}
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
