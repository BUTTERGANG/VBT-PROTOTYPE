// src/components/VideoLibraryScreen.tsx

import { useState, useEffect } from 'react';
import { localCache } from '../services/storage/LocalCache';

/**
 * Video Library - browsable collection of saved training videos
 * with links to their performance data.
 * Filter by exercise type.
 */

interface VideoEntry {
  sessionId: string;
  exercise: string;
  startTime: number;
  hasVideo: boolean;
}

export function VideoLibraryScreen() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [exerciseFilter, setExerciseFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const sessions = await localCache.getSessionHistory(100);
      const mapped: VideoEntry[] = sessions.map(s => ({
        sessionId: s.id,
        exercise: s.exercise,
        startTime: s.startTime,
        hasVideo: !s.synced, // unsynced = has local data
      }));
      setVideos(mapped);
    } catch (err) {
      console.error('Failed to load video library:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = exerciseFilter
    ? videos.filter(v => v.exercise.toLowerCase().includes(exerciseFilter.toLowerCase()))
    : videos;

  const exercises = [...new Set(videos.map(v => v.exercise))];

  return (
    <div className="screen-container" style={{ paddingBottom: '80px' }}>
      <div style={{ paddingTop: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <h2 className="text-heading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
          Video Library
        </h2>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
          {videos.length} sets recorded
        </div>
      </div>

      {/* Exercise filter chips */}
      {exercises.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <button
            onClick={() => setExerciseFilter('')}
            style={{
              padding: '4px 10px', borderRadius: '999px',
              border: `1px solid ${!exerciseFilter ? 'var(--color-brand)' : 'var(--color-border)'}`,
              backgroundColor: !exerciseFilter ? 'var(--color-brand)' : 'transparent',
              color: !exerciseFilter ? '#000' : 'var(--color-text-muted)',
              fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            All
          </button>
          {exercises.map(ex => (
            <button
              key={ex}
              onClick={() => setExerciseFilter(exerciseFilter === ex ? '' : ex)}
              style={{
                padding: '4px 10px', borderRadius: '999px',
                border: `1px solid ${exerciseFilter === ex ? 'var(--color-brand)' : 'var(--color-border)'}`,
                backgroundColor: exerciseFilter === ex ? 'var(--color-brand)' : 'transparent',
                color: exerciseFilter === ex ? '#000' : 'var(--color-text-muted)',
                fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Video list */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <span className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>🎬</div>
          <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>No videos yet</div>
          <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Record sets with video enabled to build your library
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(video => {
            const date = new Date(video.startTime);
            return (
              <div
                key={video.sessionId}
                className="card"
                style={{ padding: 'var(--space-4)', cursor: 'pointer' }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <div className="text-subheading" style={{ color: 'var(--color-text-primary)', margin: 0 }}>
                    {video.exercise}
                  </div>
                  <div style={{ fontSize: '20px' }}>📹</div>
                </div>
                <div className="flex gap-3" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <span>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  {video.hasVideo && <span style={{ color: '#10b981' }}>● Local</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
