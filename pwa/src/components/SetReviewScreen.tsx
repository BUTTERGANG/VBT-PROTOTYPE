import { useRef, useEffect, useState } from 'react';
import { useLiftStore } from '../store/liftStore';
import { estimate1RM } from '../utils/oneRMCalculator';
import type { VelocityReading, Rep, ZoneResult } from '../types';

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

function zoneColor(zone: ZoneResult | string): string {
  if (zone === 'IN_RANGE') return 'var(--zone-in-range)';
  if (zone === 'FAST') return 'var(--zone-fast)';
  return 'var(--zone-slow)';
}

export function SetReviewScreen({ data, onSave, onDiscard, onStartWorkout }: SetReviewScreenProps) {
  const { completedReps, exercise: storeExercise } = useLiftStore();

  const initialExercise = data?.exercise ?? storeExercise;
  const initialWeight = data?.weight ?? 0;
  const initialReps = data?.reps ?? completedReps;
  const videoUrl = data?.videoUrl ?? null;
  const barPath = data?.barPath ?? [];
  const prevSet = data?.prevSet;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [exercise, setExercise] = useState(initialExercise);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState<Rep[]>(initialReps);
  const [rpe, setRpe] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showBarPath, setShowBarPath] = useState(true);

  const removeRep = (index: number) => {
    setReps(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, repNumber: i + 1 })));
  };

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

  useEffect(() => {
    if (!canvasRef.current || barPath.length === 0 || !showBarPath) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const video = videoRef.current;
    if (video) { canvas.width = video.clientWidth; canvas.height = video.clientHeight; }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (barPath.length > 1) {
        const xs = barPath.map(p => p.x); const ys = barPath.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 1; const rangeY = maxY - minY || 1;
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        for (let i = 0; i < barPath.length; i++) {
          const px = ((barPath[i].x - minX) / rangeX) * canvas.width * 0.8 + canvas.width * 0.1;
          const py = ((barPath[i].y - minY) / rangeY) * canvas.height * 0.8 + canvas.height * 0.1;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        const last = barPath[barPath.length - 1];
        const lx = ((last.x - minX) / rangeX) * canvas.width * 0.8 + canvas.width * 0.1;
        const ly = ((last.y - minY) / rangeY) * canvas.height * 0.8 + canvas.height * 0.1;
        ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [barPath, showBarPath]);

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '80px', overflowY: 'auto' }}>
      {/* Dimmed backdrop for edit modal */}
      {showEdit && (
        <div
          onClick={() => setShowEdit(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-heading page-title">Set Review</h1>
          <div className="text-caption page-subtitle">{exercise} — {weight}kg × {totalReps} reps</div>
        </div>
        <button
          onClick={() => setShowEdit(!showEdit)}
          title="Edit set details"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)',
            fontSize: '12px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
            padding: '6px 10px', transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          EDIT
        </button>
      </div>

      {/* Edit form — appears above content with backdrop */}
      {showEdit && (
        <div className="card" style={{ position: 'relative', zIndex: 11, marginBottom: 'var(--space-4)', borderColor: 'var(--color-brand-border)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', fontSize: '11px' }}>EDIT SET</div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="app-label">Exercise</label>
            <input type="text" value={exercise} onChange={(e) => setExercise(e.target.value)} className="app-input" />
          </div>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label className="app-label">Weight (kg)</label>
            <input type="number" step="0.5" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} className="app-input mono" />
          </div>
          <button onClick={() => setShowEdit(false)} className="btn btn-pill btn-brand" style={{ width: '100%' }}>Done</button>
        </div>
      )}

      {/* Video playback */}
      {videoUrl && (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto var(--space-4)' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{ width: '100%', borderRadius: 'var(--radius-lg)', backgroundColor: '#0f0f0f', display: 'block' }}
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          {barPath.length > 0 && (
            <button
              onClick={() => setShowBarPath(!showBarPath)}
              style={{
                position: 'absolute', top: '8px', right: '8px',
                padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.7)',
                border: `1px solid ${showBarPath ? '#22c55e' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: showBarPath ? '#22c55e' : 'var(--color-text-muted)',
                fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}
            >
              {showBarPath ? '◯ PATH' : '◯ PATH'}
            </button>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>VELOCITY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <StatBox label="BEST" value={bestVelocity.toFixed(2)} unit="m/s" color="var(--zone-in-range)" />
          <StatBox label="AVG" value={avgVelocity.toFixed(2)} unit="m/s" color="var(--color-brand)" />
          <StatBox label="LOSS" value={`${(velocityLoss * 100).toFixed(0)}%`} unit="" color={velocityLoss > 0.2 ? 'var(--zone-fast)' : 'var(--zone-slow)'} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: e1RM ? '1fr 1fr' : '1fr', gap: 'var(--space-2)' }}>
          {e1RM && <StatBox label="e1RM" value={`${e1RM}`} unit="kg" color="#3b82f6" />}
          <StatBox label="POWER" value={`${(weight * avgVelocity).toFixed(0)}`} unit="W" color="#8b5cf6" />
        </div>
        {vsLastSet !== null && (
          <div className="text-caption" style={{ color: vsLastSet >= 0 ? 'var(--zone-in-range)' : 'var(--zone-fast)', marginTop: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>
            vs last set: {vsLastSet >= 0 ? '+' : ''}{vsLastSet.toFixed(3)} m/s
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {[
            { label: `${weight}kg` },
            { label: `${totalReps} reps` },
            { label: `${avgVelocity.toFixed(2)} m/s avg` },
            { label: `MRS ${mrs.toFixed(2)}` },
            ...(e1RM ? [{ label: `e1RM ${e1RM}kg` }] : []),
            ...(rpe ? [{ label: `RPE ${rpe}` }] : []),
          ].map(b => (
            <span key={b.label} style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px',
              backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              fontSize: '12px', color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Zone adherence */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontSize: '11px' }}>ZONE ADHERENCE</div>
        <div style={{ position: 'relative', height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-2)', backgroundColor: 'var(--color-bg)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ width: `${zonePct}%`, backgroundColor: 'var(--zone-in-range)' }} />
            <div style={{ width: `${100 - zonePct}%`, backgroundColor: 'var(--zone-slow)' }} />
          </div>
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          {repsInZone} of {totalReps} reps in zone ({zonePct}%)
        </div>
      </div>

      {/* RPE */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>RPE — Rate of Perceived Exertion</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(val => (
            <button
              key={val}
              onClick={() => setRpe(val === rpe ? null : val)}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-pill)', minHeight: '36px',
                border: `1px solid ${rpe === val ? 'var(--color-brand)' : 'var(--color-border)'}`,
                backgroundColor: rpe === val ? 'rgba(62,207,142,0.15)' : 'transparent',
                color: rpe === val ? 'var(--color-brand)' : 'var(--color-text-muted)',
                fontSize: '12px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                fontWeight: rpe === val ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Velocity chart */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>VELOCITY PER REP</div>
        <div className="rep-chart" style={{ height: '80px' }}>
          {velocities.map((v, i) => {
            const maxV = bestVelocity || 1;
            const heightPct = (v / maxV) * 100;
            const zone: ZoneResult = reps[i]?.zoneResult || 'SLOW';
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div className="rep-chart-bar" style={{ width: '100%', height: `${heightPct}%`, backgroundColor: zoneColor(zone) }} />
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rep-by-rep table */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>REP DETAILS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['', 'Rep', 'Mean Vel', 'Peak Vel', 'Zone', 'e1RM'].map(h => (
                  <th key={h} style={{ padding: 'var(--space-2)', textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reps.map((rep, i) => {
                const zc = zoneColor(rep.zoneResult);
                const repE1RM = weight > 0 ? estimate1RM(weight, rep.meanVelocity, 'M1') : null;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <button
                        onClick={() => removeRep(i)}
                        title="Remove false rep"
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '16px', padding: '0 2px', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-faint)')}
                      >
                        −
                      </button>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{rep.repNumber}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.meanVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>{rep.peakVelocity.toFixed(2)}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <span className="zone-badge" style={{ color: zc, backgroundColor: `${zc}18` }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <button onClick={onSave} className="btn btn-pill btn-brand" style={{ width: '100%' }}>
          Save Set
        </button>
        <button onClick={onStartWorkout} className="btn btn-pill" style={{ width: '100%', border: '1px solid var(--color-brand)', color: 'var(--color-brand)' }}>
          Start Workout
        </button>
        <button onClick={onDiscard} className="btn btn-pill btn-discard" style={{ width: '100%' }}>
          Discard
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.5px', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div style={{ color, fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>{unit}</div>}
    </div>
  );
}
