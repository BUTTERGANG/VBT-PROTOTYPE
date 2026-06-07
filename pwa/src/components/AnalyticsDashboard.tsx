// src/components/AnalyticsDashboard.tsx

import { useState, useEffect } from 'react';
import { api } from '../services/api/client';
import type { DashboardAnalytics } from '../types';

interface AnalyticsDashboardProps {
  athleteId?: string;
}

const ZONE_COLORS: Record<string, string> = {
  FAST: '#ef4444',
  IN_RANGE: '#10b981',
  SLOW: '#6b7280',
};

const TREND_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
      // Map snake_case API response to camelCase types
      setData({
        velocityTrend: result.velocity_trend || [],
        zoneDistribution: result.zone_distribution || [],
        fatigueAlerts: result.fatigue_alerts || [],
        programAdherence: result.program_adherence || [],
      });
      setOffline(false);
    } catch (err) {
      console.warn('Analytics API unavailable, showing empty state:', err);
      setOffline(true);
      // Provide empty data so the UI still renders
      setData({
        velocityTrend: [],
        zoneDistribution: [],
        fatigueAlerts: [],
        programAdherence: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-container" style={{ paddingBottom: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Loading analytics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="screen-container" style={{ paddingBottom: '80px' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📊</div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No data available</div>
        </div>
      </div>
    );
  }

  // Zone distribution bar
  const totalZoneReps = data.zoneDistribution.reduce((sum, z) => sum + z.count, 0);

  // Group velocity trend by exercise
  const trendByExercise: Record<string, { date: string; avgVelocity: number }[]> = {};
  data.velocityTrend.forEach((point) => {
    if (!trendByExercise[point.exercise]) trendByExercise[point.exercise] = [];
    trendByExercise[point.exercise].push({
      date: point.sessionDate,
      avgVelocity: point.avgVelocity,
    });
  });

  const exercises = Object.keys(trendByExercise);

  // Find max velocity for chart scaling
  const maxVelocity = Math.max(1, ...data.velocityTrend.map((p) => p.avgVelocity));

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Offline banner */}
      {offline && (
        <div style={{
          padding: 'var(--space-2) var(--space-4)',
          backgroundColor: 'rgba(245,158,11,0.1)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: '#f59e0b',
          textAlign: 'center',
          marginBottom: 'var(--space-3)',
        }}>
          ⚡ Offline — connect to sync analytics
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-2" style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="btn btn-pill btn-secondary"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: '12px',
              backgroundColor: days === d ? 'var(--color-brand)' : undefined,
              color: days === d ? '#000' : undefined,
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Zone Distribution */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          ZONE DISTRIBUTION
        </div>
        {totalZoneReps > 0 ? (
          <>
            <div className="flex" style={{ height: '12px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
              {data.zoneDistribution.map((zone) => (
                <div
                  key={zone.zoneResult}
                  style={{
                    width: `${zone.percentage}%`,
                    backgroundColor: ZONE_COLORS[zone.zoneResult] || '#6b7280',
                    transition: 'width 0.3s',
                  }}
                />
              ))}
            </div>
            <div className="flex gap-4">
              {data.zoneDistribution.map((zone) => (
                <div key={zone.zoneResult} className="flex items-center gap-1.5">
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ZONE_COLORS[zone.zoneResult] }} />
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {zone.zoneResult === 'IN_RANGE' ? 'In Zone' : zone.zoneResult === 'FAST' ? 'Too Fast' : 'Too Slow'}
                  </span>
                  <span className="text-mono-sm" style={{ color: 'var(--color-text-primary)' }}>
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
        <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          VELOCITY TREND
        </div>
        {data.velocityTrend.length > 0 ? (
          <div style={{ position: 'relative', height: '160px' }}>
            {/* Y-axis labels */}
            <div
              className="flex flex-col justify-between"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 20,
                width: '30px',
                textAlign: 'right',
              }}
            >
              <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)', transform: 'translateY(-50%)' }}>
                {maxVelocity.toFixed(1)}
              </span>
              <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                {(maxVelocity / 2).toFixed(1)}
              </span>
              <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)', transform: 'translateY(50%)' }}>
                0
              </span>
            </div>

            {/* Chart area */}
            <div
              style={{
                position: 'absolute',
                left: '35px',
                right: 0,
                top: 0,
                bottom: '20px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
              }}
            >
              {data.velocityTrend.map((point, i) => {
                const exerciseIdx = exercises.indexOf(point.exercise);
                const height = (point.avgVelocity / maxVelocity) * 100;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: TREND_COLORS[exerciseIdx % TREND_COLORS.length],
                      borderRadius: '2px 2px 0 0',
                      minWidth: '4px',
                      opacity: 0.85,
                    }}
                    title={`${point.exercise}: ${point.avgVelocity.toFixed(2)} m/s (${new Date(point.sessionDate).toLocaleDateString()})`}
                  />
                );
              })}
            </div>

            {/* X-axis */}
            <div
              style={{
                position: 'absolute',
                left: '35px',
                right: 0,
                bottom: 0,
                height: '20px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {data.velocityTrend.length > 0 && (
                <>
                  <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                    {new Date(data.velocityTrend[0].sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span className="text-mono" style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                    {new Date(data.velocityTrend[data.velocityTrend.length - 1].sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
            No velocity data yet
          </div>
        )}

        {/* Legend */}
        {exercises.length > 0 && (
          <div className="flex gap-3" style={{ marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            {exercises.map((ex, i) => (
              <div key={ex} className="flex items-center gap-1">
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }} />
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>{ex}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fatigue Alerts */}
      {data.fatigueAlerts.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            FATIGUE ALERTS ({data.fatigueAlerts.length})
          </div>
          <div className="flex flex-col gap-2">
            {data.fatigueAlerts.slice(0, 5).map((alert, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${alert.velocityDropPct > 0.15 ? '#ef4444' : '#f59e0b'}`,
                }}
              >
                <div>
                  <div className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {alert.exercise} — Set {alert.setNumber}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(alert.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-mono" style={{
                  color: alert.velocityDropPct > 0.15 ? '#ef4444' : '#f59e0b',
                  fontWeight: 600,
                }}>
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
          <div className="text-mono" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            PROGRAM ADHERENCE
          </div>
          <div className="flex flex-col gap-3">
            {data.programAdherence.map((prog, i) => (
              <div key={i}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span className="text-body-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {prog.programName}
                  </span>
                  <span className="text-mono-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {prog.sessionsCompleted} sessions
                  </span>
                </div>
                {prog.startDate && (
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(prog.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' → '}
                    {prog.endDate ? new Date(prog.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Ongoing'}
                    {prog.isActive && (
                      <span style={{ color: 'var(--color-brand)', marginLeft: '8px' }}>● Active</span>
                    )}
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
