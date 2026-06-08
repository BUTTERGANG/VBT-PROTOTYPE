import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import { localCache } from '../services/storage/LocalCache';
import type { Session } from '../types';

interface SessionHistoryScreenProps {
  athleteId?: string;
  onSelectSession?: (sessionId: string) => void;
}

const ZONE_COLORS: Record<string, string> = {
  FAST: 'var(--zone-fast)',
  IN_RANGE: 'var(--zone-in-range)',
  SLOW: 'var(--zone-slow)',
};

export function SessionHistoryScreen({ athleteId, onSelectSession }: SessionHistoryScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
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
      setOffline(false);
    } catch (err) {
      console.warn('API unavailable, falling back to local cache:', err);
      setOffline(true);
      try {
        const cached = await localCache.getSessionHistory(LIMIT);
        const mapped = cached.map(s => ({
          id: s.id,
          athleteId: s.athleteId,
          exercise: s.exercise,
          startTime: new Date(s.startTime).toISOString(),
          endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
          sets: [],
          totalReps: 0,
          avgVelocity: 0,
        }));
        const filtered = exerciseFilter
          ? mapped.filter(s => s.exercise.toLowerCase().includes(exerciseFilter.toLowerCase()))
          : mapped;
        setSessions(reset ? filtered : [...sessions, ...filtered]);
        setHasMore(false);
      } catch (cacheErr) {
        console.error('LocalCache also failed:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  }, [athleteId, exerciseFilter, offset, sessions]);

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
      {/* Offline banner */}
      {offline && (
        <div className="offline-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Offline — showing cached data
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        <input
          type="text"
          placeholder="Filter by exercise…"
          value={exerciseFilter}
          onChange={(e) => setExerciseFilter(e.target.value)}
          className="app-input"
          style={{ fontSize: '14px' }}
        />
      </div>

      {/* Session list */}
      {sessions.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No sessions yet</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Completed sessions will appear here
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session: any) => (
            <button
              key={session.id}
              onClick={() => onSelectSession?.(session.id)}
              className="session-card"
            >
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <div className="text-body" style={{ color: 'var(--color-text-primary)', fontWeight: 600, margin: 0 }}>
                  {session.exercise}
                </div>
                {session.fatigue_flag && (
                  <span className="zone-badge" style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239,68,68,0.1)' }}>
                    ⚠ FATIGUE
                  </span>
                )}
              </div>

              {/* Date/time + athlete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(session.startTime || session.start_time)}
                </span>
                <span className="text-caption" style={{ color: 'var(--color-text-faint)' }}>
                  {formatTime(session.startTime || session.start_time)}
                </span>
                {session.athlete_name && (
                  <span className="text-caption" style={{ color: 'var(--color-brand)' }}>
                    {session.athlete_name}
                  </span>
                )}
              </div>

              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <div>
                  <span className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '18px', fontWeight: 700 }}>
                    {session.totalReps || session.total_reps || 0}
                  </span>
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>reps</span>
                </div>
                <div>
                  <span className="text-mono" style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 600 }}>
                    {(session.avgVelocity || session.avg_velocity || 0).toFixed(2)}
                  </span>
                  <span className="text-caption" style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>m/s avg</span>
                </div>
              </div>

              {/* Zone mini-bar — taller and more readable */}
              {session.sets && session.sets.length > 0 && (
                <div style={{ display: 'flex', gap: '2px', marginTop: 'var(--space-3)', height: '8px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {session.sets.map((set: any, i: number) =>
                    set.reps?.map((rep: any, j: number) => (
                      <div
                        key={`${i}-${j}`}
                        style={{
                          flex: 1,
                          backgroundColor: ZONE_COLORS[rep.zone_result] || 'var(--zone-slow)',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '110px', borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
