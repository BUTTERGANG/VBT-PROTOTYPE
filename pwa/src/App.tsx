import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveLiftScreen } from './components/LiveLiftScreen';
const CameraLiveLiftScreen = lazy(() => import('./components/CameraLiveLiftScreen'));
import { PostSetSummaryScreen } from './components/PostSetSummaryScreen';
import { SessionHistoryScreen } from './components/SessionHistoryScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AthleteProfilesScreen } from './components/AthleteProfilesScreen';
import { CoachModeScreen } from './components/CoachModeScreen';
import { WorkoutScreen } from './components/WorkoutScreen';
import { SetReviewScreen } from './components/SetReviewScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SyncIndicator } from './components/SyncIndicator';
import { VideoLibraryScreen } from './components/VideoLibraryScreen';
import { HomeScreen } from './components/HomeScreen';
import { AuthScreen } from './components/AuthScreen';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAuthStore } from './store/authStore';
import type { Rep } from './types';

// ─── Tab definitions ────────────────────────────────────────────────────

const TABS: { path: string; label: string; icon: string }[] = [
  { path: '/', label: 'HOME', icon: 'home' },
  { path: '/camera', label: 'CAMERA', icon: 'camera' },
  { path: '/workout', label: 'WORKOUT', icon: 'dumbbell' },
  { path: '/history', label: 'HISTORY', icon: 'list' },
  { path: '/analytics', label: 'STATS', icon: 'chart' },
  { path: '/videos', label: 'VIDEOS', icon: 'film' },
  { path: '/athletes', label: 'TEAM', icon: 'team' },
  { path: '/coach', label: 'COACH', icon: 'users' },
  { path: '/live', label: 'BLE', icon: 'bolt' },
  { path: '/settings', label: 'SETTINGS', icon: 'gear' },
];

// Bottom bar shows 5 + gear; sidebar shows all
const MOBILE_TABS = TABS.filter(t => !['/coach', '/live', '/settings'].includes(t.path));
const SIDEBAR_WIDTH = 200;

// ─── Icons ──────────────────────────────────────────────────────────────

function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
  const icons: Record<string, ReactNode> = {
    home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    bolt: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    dumbbell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6 12h12M6.5 17.5h11" /><circle cx="4" cy="6.5" r="2" /><circle cx="20" cy="6.5" r="2" /><circle cx="4" cy="17.5" r="2" /><circle cx="20" cy="17.5" r="2" /></svg>,
    list: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
    chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    team: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
    gear: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    film: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" /></svg>,
  };
  return icons[type] || icons.bolt;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function useMediaQuery(minWidth: number): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [minWidth]);
  return matches;
}

function CameraLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)', padding: 'var(--space-4)', paddingBottom: '80px' }}>
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', maxWidth: '500px' }}>
        <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📷</div>
        <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Loading Camera Mode</div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Loading ML models & camera pipeline...</div>
        <div className="pulse-bar" style={{ marginTop: 'var(--space-4)', width: '200px', height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div className="pulse-bar-fill" />
        </div>
      </div>
    </div>
  );
}

// ─── Persisted workout state ────────────────────────────────────────────

const WORKOUT_KEY = 'vbt_workout_sets';

function loadWorkoutSets(): Array<{ id: string; exercise: string; weight: number; reps: Rep[]; avgVelocity: number; bestVelocity: number; timestamp: number }> {
  try {
    const raw = sessionStorage.getItem(WORKOUT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Main App Content ───────────────────────────────────────────────────

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isInstallable, promptInstall, showIOSBanner, dismissIOSBanner } = usePWAInstall();
  const isDesktop = useMediaQuery(1024);

  const { user, token, validateToken } = useAuthStore();

  // Validate stored token on app boot
  useEffect(() => { validateToken(); }, []);

  // Persisted workout sets (survive navigation, lost on tab close which is fine)
  const [workoutSets] = useState(loadWorkoutSets);

  // Camera upload mode flag (passed to CameraLiveLiftScreen)
  const [cameraInputMode, setCameraInputMode] = useState<'camera-live' | 'camera-record' | 'upload'>('camera-record');

  // ── Navigation callbacks ─────────────────────────────────────────────

  // handleAddSet is no longer needed — recording flow goes camera→review→workout
  // via react-router navigation. Kept as no-op for backward compat.

  const handleUploadSet = useCallback(() => {
    setCameraInputMode('upload');
    navigate('/camera');
  }, [navigate]);

  const handleFinishWorkout = useCallback(() => {
    navigate('/summary');
  }, [navigate]);

  const handleRecordAnother = useCallback(() => {
    setCameraInputMode('camera-record');
    navigate('/camera');
  }, [navigate]);

  // ── Auth guard ────────────────────────────────────────────────────────

  if (!token || !user) {
    return <AuthScreen />;
  }

  const currentPath = location.pathname;
  const isTabActive = (path: string) =>
    path === '/' ? currentPath === '/' : currentPath === path;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex' }}>
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside style={{ width: SIDEBAR_WIDTH, flexShrink: 0, backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 40 }}>
          <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '14px', fontWeight: 700 }}>
              VBT<span style={{ color: 'var(--color-text-muted)' }}>TRACKER</span>
            </span>
          </div>

          <nav style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TABS.map((tab) => {
              const active = isTabActive(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)',
                    backgroundColor: active ? 'rgba(62,207,142,0.12)' : 'transparent',
                    color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    fontSize: '13px', fontWeight: active ? 600 : 400,
                    transition: 'background-color 0.15s, color 0.15s', textAlign: 'left', minHeight: '44px',
                    borderLeft: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                  }}
                >
                  <TabIcon type={tab.icon} active={active} />
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {tab.path === '/history' && <SyncIndicator />}
                </button>
              );
            })}
          </nav>

          {isInstallable && !showIOSBanner && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <button onClick={promptInstall} className="btn btn-pill btn-brand" style={{ width: '100%', fontSize: '12px' }}>Install App</button>
            </div>
          )}
        </aside>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: isDesktop ? SIDEBAR_WIDTH : 0, minHeight: '100dvh' }}>
        {/* Install banner */}
        {isInstallable && !isDesktop && (
          <div style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3) var(--space-4)' }}>
            {showIOSBanner ? (
              <div className="flex items-center justify-between" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ flex: 1 }}>
                  <div className="text-caption font-medium" style={{ color: 'var(--color-text-primary)' }}>Install VBT Tracker on iPhone</div>
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>Tap <span style={{ fontSize: '16px' }}>⬆</span> Share → "Add to Home Screen"</div>
                </div>
                <button onClick={dismissIOSBanner} className="btn btn-pill" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '12px', color: 'var(--color-text-muted)' }}>Dismiss</button>
              </div>
            ) : (
              <div className="flex items-center justify-between" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div>
                  <div className="text-caption font-medium" style={{ color: 'var(--color-text-primary)' }}>Install VBT Tracker</div>
                  <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Add to home screen for offline use</div>
                </div>
                <button onClick={promptInstall} className="btn btn-pill btn-brand" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}>Install</button>
              </div>
            )}
          </div>
        )}

        {/* Routed content with transitions */}
        <div className="screen-transition" style={{ flex: 1, maxWidth: isDesktop ? '960px' : '100%', width: '100%', margin: '0 auto' }}>
          <Suspense fallback={<CameraLoadingSkeleton />}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/live" element={<LiveLiftScreen />} />
              <Route path="/camera" element={<CameraLiveLiftScreen initialInputMode={cameraInputMode} />} />
              <Route path="/summary" element={<PostSetSummaryScreen />} />
              <Route path="/review" element={
                <SetReviewScreen
                  onSave={() => navigate('/workout')}
                  onDiscard={() => navigate('/camera')}
                  onStartWorkout={() => navigate('/workout')}
                />
              } />
              <Route path="/workout" element={
                <WorkoutScreen
                  initialSets={workoutSets}
                  onFinish={handleFinishWorkout}
                  onAddSet={handleRecordAnother}
                  onUploadSet={handleUploadSet}
                />
              } />
              <Route path="/history" element={<SessionHistoryScreen />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
              <Route path="/athletes" element={<AthleteProfilesScreen />} />
              <Route path="/coach" element={<CoachModeScreen />} />
              <Route path="/videos" element={<VideoLibraryScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: 'var(--color-bg)', borderTop: '1px solid var(--color-border-subtle)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 50 }}>
          <div className="container">
            <div className="flex">
              {MOBILE_TABS.map((tab) => {
                const active = isTabActive(tab.path);
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    style={{
                      flex: 1, padding: '10px 0', flexDirection: 'column', gap: '4px',
                      borderRadius: 0,
                      color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                      backgroundColor: 'transparent', cursor: 'pointer', border: 'none',
                      borderBottomWidth: '2px', borderBottomStyle: 'solid',
                      borderBottomColor: active ? 'var(--color-brand)' : 'transparent',
                      minHeight: '60px', transition: 'color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}><TabIcon type={tab.icon} active={active} /></div>
                    <span className="text-mono" style={{ fontSize: '9px' }}>{tab.label}</span>
                  </button>
                );
              })}
              {/* Settings gear */}
              <button
                onClick={() => navigate('/settings')}
                style={{
                  width: '44px', padding: '10px 0', flexDirection: 'column', gap: '4px',
                  borderRadius: 0,
                  color: currentPath === '/settings' ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  backgroundColor: 'transparent', cursor: 'pointer', border: 'none', minHeight: '60px',
                  borderBottom: currentPath === '/settings' ? '2px solid var(--color-brand)' : '2px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}><TabIcon type="gear" active={currentPath === '/settings'} /></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root with router ───────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
