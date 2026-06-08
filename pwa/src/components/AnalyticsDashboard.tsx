import { useState, useEffect } from 'react';
import { api } from '../services/api/client';
import type { DashboardAnalytics } from '../types';

interface AnalyticsDashboardProps {
  athleteId?: string;
}

const ZONE_COLORS: Record<string, string> = {
  FAST: 'var(--zone-fast)',
  IN_RANGE: 'var(--zone-in-range)',
  SLOW: 'var(--zone-slow)',
};

const TREND_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsDashboard({ athleteId }: AnalyticsDashboardProps) {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadDashboard();
  }, [athleteId, days]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result: any = await api.getDashboard({ athlete_id: athleteId, days });
      setData({
        velocityTrend: result.velocity_trend || [],
        zoneDistribution: result.zone_distribution || [],
        fatigueAlerts: result.fatigue_alerts || [],
        programAdherence: result.program_adherence || [],
      });
      setOffline(false);
    } catch (err) {
      console.warn('Analytics API unavailable:', err);
      setOffline(true);
      setData({ velocityTrend: [], zoneDistribution: [], fatigueAlerts: [], programAdherence: [] });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-container" style={{ paddingBottom: '80px' }}>
        <div className="page-header" style={{ paddingTop: 'var(--space-2)' }}>
          <h2 className="text-heading page-title">Analytics</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius-pill)', width: '200px' }} />
          <div className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-xl)' }} />
          <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-xl)' }} />
          <div className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-xl)' }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="screen-container" style={{ paddingBottom: '80px' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No data available</div>
        </div>
      </div>
    );
  }

  const totalZoneReps = data.zoneDistribution.reduce((sum, z) => sum + z.count, 0);
  const trendByExercise: Record<string, { date: string; avgVelocity: number }[]> = {};
  data.velocityTrend.forEach(point => {
    if (!trendByExercise[point.exercise]) trendByExercise[point.exercise] = [];
    trendByExercise[point.exercise].push({ date: point.sessionDate, avgVelocity: point.avgVelocity });
  });
  const exercises = Object.keys(trendByExercise);
  const maxVelocity = Math.max(1, ...data.velocityTrend.map(p => p.avgVelocity));

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ paddingTop: 'var(--space-2)' }}>
        <h2 className="text-heading page-title">Analytics</h2>
      </div>

      {offline && (
        <div className="offline-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Offline — connect to sync analytics
        </div>
      )}

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {[7, 14, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`btn-period${days === d ? ' active' : ''}`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Zone Distribution */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>ZONE DISTRIBUTION</div>
        {totalZoneReps > 0 ? (
          <>
            <div style={{ display: 'flex', height: '14px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-3)', backgroundColor: 'var(--color-bg)' }}>
              {data.zoneDistribution.map(zone => (
                <div
                  key={zone.zoneResult}
                  title={`${zone.zoneResult === 'IN_RANGE' ? 'In Zone' : zone.zoneResult === 'FAST' ? 'Too Fast' : 'Too Slow'}: ${zone.percentage}%`}
                  style={{ width: `${zone.percentage}%`, backgroundColor: ZONE_COLORS[zone.zoneResult] || 'var(--zone-slow)', transition: 'width 0.3s' }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              {data.zoneDistribution.map(zone => (
                <div key={zone.zoneResult} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ZONE_COLORS[zone.zoneResult] }} />
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {zone.zoneResult === 'IN_RANGE' ? 'In Zone' : zone.zoneResult === 'FAST' ? 'Too Fast' : 'Too Slow'}
                  </span>
                  <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 700 }}>
                    {zone.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>No reps recorded yet</div>
        )}
      </div>

      {/* Velocity Trend Chart */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>VELOCITY TREND</div>
        {data.velocityTrend.length > 0 ? (
          <div style={{ position: 'relative', height: '200px' }}>
            {/* Y-axis */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: '24px', width: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: '4px' }}>
              {[maxVelocity, maxVelocity / 2, 0].map((v, i) => (
                <span key={i} className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  {v.toFixed(1)}
                </span>
              ))}
            </div>

            {/* Gridlines */}
            <div style={{ position: 'absolute', left: '36px', right: 0, top: 0, bottom: '24px' }}>
              {[0, 50, 100].map(pct => (
                <div key={pct} style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${pct}%`, borderTop: '1px solid var(--color-border-subtle)',
                }} />
              ))}
            </div>

            {/* Chart bars */}
            <div style={{
              position: 'absolute', left: '36px', right: 0,
              top: 0, bottom: '24px',
              display: 'flex', alignItems: 'flex-end', gap: '2px',
            }}>
              {data.velocityTrend.map((point, i) => {
                const exerciseIdx = exercises.indexOf(point.exercise);
                const height = (point.avgVelocity / maxVelocity) * 100;
                return (
                  <div
                    key={i}
                    title={`${point.exercise}: ${point.avgVelocity.toFixed(2)} m/s (${new Date(point.sessionDate).toLocaleDateString()})`}
                    style={{
                      flex: 1, height: `${Math.max(height, 2)}%`,
                      backgroundColor: TREND_COLORS[exerciseIdx % TREND_COLORS.length],
                      borderRadius: '2px 2px 0 0', minWidth: '4px', opacity: 0.85,
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </div>

            {/* X-axis dates */}
            <div style={{ position: 'absolute', left: '36px', right: 0, bottom: 0, height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                {new Date(data.velocityTrend[0].sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                {new Date(data.velocityTrend[data.velocityTrend.length - 1].sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
            No velocity data yet
          </div>
        )}

        {exercises.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
            {exercises.map((ex, i) => (
              <div key={ex} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }} />
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>{ex}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fatigue Alerts */}
      {data.fatigueAlerts.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>
            FATIGUE ALERTS ({data.fatigueAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.fatigueAlerts.slice(0, 5).map((alert, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3)', backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${alert.velocityDropPct > 0.15 ? 'var(--zone-fast)' : '#f59e0b'}`,
                }}
              >
                <div>
                  <div className="text-body-sm" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {alert.exercise} — Set {alert.setNumber}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(alert.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-mono" style={{ color: alert.velocityDropPct > 0.15 ? 'var(--zone-fast)' : '#f59e0b', fontWeight: 700, fontSize: '14px' }}>
                  -{(alert.velocityDropPct * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Program Adherence */}
      {data.programAdherence.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', fontSize: '11px' }}>PROGRAM ADHERENCE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {data.programAdherence.map((prog, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span className="text-body-sm" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{prog.programName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {prog.isActive && (
                      <span className="zone-badge" style={{ color: 'var(--color-brand)', backgroundColor: 'rgba(62,207,142,0.1)' }}>● ACTIVE</span>
                    )}
                    <span className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{prog.sessionsCompleted} sessions</span>
                  </div>
                </div>
                {prog.startDate && (
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(prog.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' → '}
                    {prog.endDate ? new Date(prog.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Ongoing'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
