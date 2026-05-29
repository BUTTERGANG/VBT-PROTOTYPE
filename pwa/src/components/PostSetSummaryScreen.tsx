// src/components/PostSetSummaryScreen.tsx

import { useLiftStore } from '../store/liftStore';

export function PostSetSummaryScreen() {
  const { completedReps, exercise } = useLiftStore();

  const reps = completedReps;
  const totalReps = reps.length;

  const avgVelocity = totalReps > 0
    ? reps.reduce((sum, r) => sum + r.meanVelocity, 0) / totalReps
    : 0;

  const peakVelocity = totalReps > 0
    ? Math.max(...reps.map((r) => r.peakVelocity))
    : 0;

  const repsInZone = reps.filter((r) => r.zoneResult === 'IN_RANGE').length;
  const zonePct = totalReps > 0 ? Math.round((repsInZone / totalReps) * 100) : 0;

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
