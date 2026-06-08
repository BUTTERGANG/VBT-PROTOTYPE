import { useState, useEffect } from 'react';
import { useLiftStore } from '../store/liftStore';
import { api } from '../services/api/client';
import type { Rep } from '../types';

interface AutoregResult {
  session_summary: { exercise: string; total_sets: number; total_reps: number; overall_avg_velocity: number; max_peak_velocity: number };
  set_recommendations: Array<{
    set_number: number;
    recommendation: 'increase_load' | 'decrease_load' | 'maintain' | 'stop';
    reason: string;
    suggested_velocity_target?: number;
    confidence: number;
  }>;
  overall_recommendation: string;
  overall_confidence: number;
  fatigue_detected: boolean;
  velocity_drop?: number;
  message: string;
}

const REC_COLORS: Record<string, string> = {
  increase_load: '#3b82f6',
  decrease_load: '#f59e0b',
  maintain: 'var(--zone-in-range)',
  stop: 'var(--zone-fast)',
};

const REC_LABELS: Record<string, string> = {
  increase_load: '↑ Increase Load',
  decrease_load: '↓ Decrease Load',
  maintain: '● Maintain',
  stop: '■ Stop Session',
};

export function PostSetSummaryScreen() {
  const { completedReps, exercise, zoneConfig } = useLiftStore();
  const [autoreg, setAutoreg] = useState<AutoregResult | null>(null);
  const [autoregLoading, setAutoregLoading] = useState(false);
  const [autoregError, setAutoregError] = useState<string | null>(null);

  const reps: Rep[] = completedReps;
  const totalReps = reps.length;
  const avgVelocity = totalReps > 0 ? reps.reduce((sum, r) => sum + r.meanVelocity, 0) / totalReps : 0;
  const peakVelocity = totalReps > 0 ? Math.max(...reps.map(r => r.peakVelocity)) : 0;
  const repsInZone = reps.filter(r => r.zoneResult === 'IN_RANGE').length;
  const zonePct = totalReps > 0 ? Math.round((repsInZone / totalReps) * 100) : 0;

  useEffect(() => {
    if (totalReps === 0) return;
    const fetchAutoreg = async () => {
      setAutoregLoading(true);
      setAutoregError(null);
      try {
        const result = await api.autoregulate({
          athlete_id: 'default',
          session_data: {
            exercise,
            sets: [{ set_number: 1, reps: reps.map(r => ({ mean_velocity: r.meanVelocity, peak_velocity: r.peakVelocity, zone_result: r.zoneResult })), target_velocity: zoneConfig.targetVelocity, target_tolerance: zoneConfig.tolerance }],
            target_velocity: zoneConfig.targetVelocity,
            target_tolerance: zoneConfig.tolerance,
          },
        });
        setAutoreg(result);
      } catch (err: any) {
        setAutoregError(err.message || 'Autoregulation unavailable');
      } finally {
        setAutoregLoading(false);
      }
    };
    fetchAutoreg();
  }, [totalReps, exercise]);

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      <div className="page-header">
        <div>
          <h2 className="text-heading page-title">Session Summary</h2>
          <div className="text-caption page-subtitle">{exercise} — Post-set review</div>
        </div>
      </div>

      {totalReps === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 6.5h11M6 12h12M6.5 17.5h11"/><circle cx="4" cy="6.5" r="2"/><circle cx="20" cy="6.5" r="2"/><circle cx="4" cy="17.5" r="2"/><circle cx="20" cy="17.5" r="2"/>
            </svg>
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No reps recorded</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Complete a set to see your summary
          </div>
        </div>
      ) : (
        <>
          {/* Stats grid — responsive: 3 cols on ≥400px, 1 col below */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <SummaryStatCard label="REPS" value={String(totalReps)} color="var(--color-text-primary)" />
            <SummaryStatCard label="AVG VEL" value={avgVelocity.toFixed(2)} unit="m/s" color="var(--color-brand)" />
            <SummaryStatCard label="PEAK VEL" value={peakVelocity.toFixed(2)} unit="m/s" color="var(--color-text-primary)" />
          </div>

          {/* Zone adherence */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>ZONE ADHERENCE</div>
            <div style={{ position: 'relative', height: '14px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-2)', backgroundColor: 'var(--color-bg)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                <div style={{ width: `${zonePct}%`, backgroundColor: 'var(--zone-in-range)', transition: 'width 0.5s ease' }} />
                <div style={{ width: `${100 - zonePct}%`, backgroundColor: 'var(--zone-slow)' }} />
              </div>
              {/* Percentage label inside bar */}
              {zonePct > 15 && (
                <div style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#000', fontWeight: 700, pointerEvents: 'none' }}>
                  {zonePct}%
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                {repsInZone} of {totalReps} reps in zone
              </span>
              <span className="text-mono" style={{ color: zonePct >= 70 ? 'var(--zone-in-range)' : '#f59e0b', fontWeight: 700, fontSize: '14px' }}>
                {zonePct}%
              </span>
            </div>
          </div>

          {/* Autoregulation card */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>AUTOREGULATION</div>

            {autoregLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', justifyContent: 'center' }}>
                <div className="spinner" />
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Analyzing session…</span>
              </div>
            )}

            {autoregError && (
              <div className="card card-warning" style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(245,158,11,0.06)' }}>
                <div className="text-caption" style={{ color: '#f59e0b', marginBottom: 'var(--space-1)' }}>
                  ⚡ Offline — local analysis
                </div>
                <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  {zonePct >= 80 ? 'Great set — maintain load' : zonePct >= 50 ? 'Decent set — review zone adherence' : 'Many reps out of zone — consider load adjustment'}
                </div>
              </div>
            )}

            {autoreg && !autoregLoading && (
              <>
                {autoreg.fatigue_detected && (
                  <div className="card card-error" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)', backgroundColor: 'rgba(239,68,68,0.06)' }}>
                    <div className="text-body-sm" style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '2px' }}>
                      ⚠ Fatigue Detected
                    </div>
                    {autoreg.velocity_drop != null && (
                      <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                        Velocity drop: {(autoreg.velocity_drop * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}

                {autoreg.set_recommendations.map((rec, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${REC_COLORS[rec.recommendation]}`,
                      marginBottom: i < autoreg.set_recommendations.length - 1 ? 'var(--space-2)' : 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                      <span
                        className="zone-badge"
                        style={{ color: REC_COLORS[rec.recommendation], backgroundColor: `${REC_COLORS[rec.recommendation]}18` }}
                      >
                        {REC_LABELS[rec.recommendation]}
                      </span>
                      <span className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                        {Math.round(rec.confidence * 100)}% conf
                      </span>
                    </div>
                    <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                      {rec.reason}
                    </div>
                    {rec.suggested_velocity_target && (
                      <div className="text-caption" style={{ color: 'var(--color-text-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        Target: {rec.suggested_velocity_target.toFixed(2)} m/s
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {autoreg.overall_recommendation}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Rep table */}
          <div className="card">
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>REP DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {reps.map((rep, i) => {
                const zoneColor = rep.zoneResult === 'IN_RANGE' ? 'var(--zone-in-range)' : rep.zoneResult === 'FAST' ? 'var(--zone-fast)' : 'var(--zone-slow)';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${zoneColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span className="text-mono" style={{ color: 'var(--color-text-muted)', width: '20px', fontSize: '12px' }}>
                        {rep.repNumber}
                      </span>
                      <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 600 }}>
                        {rep.meanVelocity.toFixed(2)} <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 400 }}>m/s</span>
                      </span>
                    </div>
                    <span className="zone-badge" style={{ color: zoneColor, backgroundColor: `${zoneColor}18` }}>
                      {rep.zoneResult === 'IN_RANGE' ? 'IN ZONE' : rep.zoneResult === 'FAST' ? 'FAST' : 'SLOW'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStatCard({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
      <div className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginBottom: 'var(--space-1)', letterSpacing: '0.8px' }}>
        {label}
      </div>
      <div className="text-mono" style={{ color, fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      {unit && (
        <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px', fontSize: '10px' }}>
          {unit}
        </div>
      )}
    </div>
  );
}
