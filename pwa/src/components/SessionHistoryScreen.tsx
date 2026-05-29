// src/components/SessionHistoryScreen.tsx

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import type { Session } from '../types';

interface SessionHistoryScreenProps {
  athleteId?: string;
  onSelectSession?: (sessionId: string) => void;
}

const ZONE_COLORS: Record<string, string> = {
  FAST: '#ef4444',
  IN_RANGE: '#10b981',
  SLOW: '#6b7280',
};

export function SessionHistoryScreen({ athleteId, onSelectSession }: SessionHistoryScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const loadSessions = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const data = await api.getHistory({
        athlete_id: athleteId,
        exercise: exerciseFilter || undefined,
        limit: LIMIT,
        offset: newOffset,
      });
      const newSessions = data.sessions || [];
      setSessions(reset ? newSessions : [...sessions, ...newSessions]);
      setHasMore(newSessions.length === LIMIT);
      setOffset(newOffset + LIMIT);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [athleteId, exerciseFilter, offset]);

  useEffect(() => {
    setSessions([]);
    setOffset(0);
    loadSessions(true);
  }, [athleteId, exerciseFilter]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        <input
          type="text"
          placeholder="Filter exercise..."
          value={exerciseFilter}
          onChange={(e) => setExerciseFilter(e.target.value)}
          className="flex-1"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Session list */}
      {sessions.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📋</div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No sessions yet</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Sessions completed on-device will appear here
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session: any) => (
            <button
              key={session.id}
              onClick={() => onSelectSession?.(session.id)}
              className="card text-left"
              style={{
                cursor: 'pointer',
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                transition: 'border-color 0.15s',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                <div className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                  {session.exercise}
                </div>
                {session.fatigue_flag && (
                  <span
                    className="text-caption"
                    style={{
                      color: '#ef4444',
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    ⚠ FATIGUE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(session.start_time)}
                </span>
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  {formatTime(session.start_time)}
                </span>
                {session.athlete_name && (
                  <span className="text-caption" style={{ color: 'var(--color-brand)' }}>
                    {session.athlete_name}
                  </span>
                )}
                {session.program_name && (
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                    📋 {session.program_name}
                  </span>
                )}
              </div>

              {/* Quick stats */}
              <div className="flex gap-4">
                <div>
                  <span className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '16px' }}>
                    {session.total_reps || 0}
                  </span>
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                    reps
                  </span>
                </div>
                <div>
                  <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '16px' }}>
                    {(session.avg_velocity || 0).toFixed(2)}
                  </span>
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                    m/s avg
                  </span>
                </div>
                {session.autoreg_score != null && (
                  <div>
                    <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '16px' }}>
                      {(session.autoreg_score * 100).toFixed(0)}%
                    </span>
                    <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                      score
                    </span>
                  </div>
                )}
              </div>

              {/* Zone mini-bar */}
              {session.sets && session.sets.length > 0 && (
                <div className="flex gap-1" style={{ marginTop: 'var(--space-3)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                  {session.sets.map((set: any, i: number) =>
                    set.reps?.map((rep: any, j: number) => (
                      <div
                        key={`${i}-${j}`}
                        style={{
                          flex: 1,
                          backgroundColor: ZONE_COLORS[rep.zone_result] || '#6b7280',
                          borderRadius: '1px',
                        }}
                      />
                    ))
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <button
          onClick={() => loadSessions(false)}
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 'var(--space-4)', color: 'var(--color-text-muted)' }}
        >
          Load more
        </button>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
          <span className="text-caption">Loading sessions...</span>
        </div>
      )}
    </div>
  );
}
