// src/components/PostSetSummaryScreen.tsx

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
  maintain: '#10b981',
  stop: '#ef4444',
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
  const peakVelocity = totalReps > 0 ? Math.max(...reps.map((r) => r.peakVelocity)) : 0;
  const repsInZone = reps.filter((r) => r.zoneResult === 'IN_RANGE').length;
  const zonePct = totalReps > 0 ? Math.round((repsInZone / totalReps) * 100) : 0;

  // Autoregulate on mount when we have rep data
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
            sets: [{
              set_number: 1,
              reps: reps.map((r) => ({
                mean_velocity: r.meanVelocity,
                peak_velocity: r.peakVelocity,
                zone_result: r.zoneResult,
              })),
              target_velocity: zoneConfig.targetVelocity,
              target_tolerance: zoneConfig.tolerance,
            }],
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
      <div style={{ paddingTop: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <h2 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
          Session Summary
        </h2>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
          {exercise} — Post-set review
        </div>
      </div>

      {totalReps === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>🏋️</div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
            No reps recorded
          </div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Complete a set on the VBT device to see summary
          </div>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }}>
                REPS
              </div>
              <div className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '28px', fontWeight: 700 }}>
                {totalReps}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }}>
                AVG VEL
              </div>
              <div className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '28px', fontWeight: 700 }}>
                {avgVelocity.toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-1)' }}>
                PEAK VEL
              </div>
              <div className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '28px', fontWeight: 700 }}>
                {peakVelocity.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Zone adherence */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              ZONE ADHERENCE
            </div>
            <div className="flex" style={{ height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
              <div style={{ width: `${zonePct}%`, backgroundColor: '#10b981', transition: 'width 0.3s' }} />
              <div style={{ width: `${100 - zonePct}%`, backgroundColor: '#6b7280', transition: 'width 0.3s' }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                {repsInZone} of {totalReps} reps in zone
              </span>
              <span className="text-mono-sm" style={{ color: zonePct >= 70 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {zonePct}%
              </span>
            </div>
          </div>

          {/* Autoregulation card */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              AUTOREGULATION
            </div>

            {autoregLoading && (
              <div className="text-caption" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                Analyzing session...
              </div>
            )}

            {autoregError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>
                <div className="text-caption" style={{ color: '#f59e0b' }}>
                  ⚠ Offline — {autoregError}
                </div>
                <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  Local analysis: {zonePct >= 80 ? 'Great set, maintain load' : zonePct >= 50 ? 'Decent set, review zone adherence' : 'Many reps out of zone — consider load adjustment'}
                </div>
              </div>
            )}

            {autoreg && !autoregLoading && (
              <>
                {/* Fatigue flag */}
                {autoreg.fatigue_detected && (
                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', borderLeft: '3px solid #ef4444' }}>
                    <div className="text-body-sm" style={{ color: '#ef4444', fontWeight: 600 }}>
                      ⚠ Fatigue Detected
                    </div>
                    {autoreg.velocity_drop != null && (
                      <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Velocity drop: {(autoreg.velocity_drop * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
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
                    <div className="flex items-center justify-between" style={{ marginBottom: '2px' }}>
                      <span
                        className="text-caption"
                        style={{
                          color: REC_COLORS[rec.recommendation],
                          backgroundColor: `${REC_COLORS[rec.recommendation]}15`,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          fontWeight: 600,
                        }}
                      >
                        {REC_LABELS[rec.recommendation]}
                      </span>
                      <span className="text-mono-sm" style={{ color: 'var(--color-text-muted)' }}>
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

                {/* Overall */}
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
            <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
              REP DETAILS
            </div>
            <div className="flex flex-col gap-2">
              {reps.map((rep, i) => {
                const zoneColor = rep.zoneResult === 'IN_RANGE' ? '#10b981' : rep.zoneResult === 'FAST' ? '#ef4444' : '#6b7280';
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${zoneColor}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-mono" style={{ color: 'var(--color-text-muted)', width: '24px' }}>
                        {rep.repNumber}
                      </span>
                      <span className="text-mono" style={{ color: 'var(--color-text-primary)' }}>
                        {rep.meanVelocity.toFixed(2)} m/s
                      </span>
                    </div>
                    <span
                      className="text-caption"
                      style={{
                        color: zoneColor,
                        backgroundColor: `${zoneColor}15`,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                      }}
                    >
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
