import { useState, useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveLiftScreen } from './components/LiveLiftScreen';
const CameraLiveLiftScreen = lazy(() => import('./components/CameraLiveLiftScreen'));
import { PostSetSummaryScreen } from './components/PostSetSummaryScreen';
import { SessionHistoryScreen } from './components/SessionHistoryScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AthleteProfilesScreen } from './components/AthleteProfilesScreen';
import { CoachModeScreen } from './components/CoachModeScreen';
import { usePWAInstall } from './hooks/usePWAInstall';

type Screen = 'live' | 'camera' | 'summary' | 'history' | 'analytics' | 'athletes' | 'coach';

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'live', label: 'LIFT', icon: 'bolt' },
  { id: 'camera', label: 'CAMERA', icon: 'camera' },
  { id: 'history', label: 'HISTORY', icon: 'list' },
  { id: 'analytics', label: 'STATS', icon: 'chart' },
  { id: 'coach', label: 'COACH', icon: 'users' },
  { id: 'athletes', label: 'TEAM', icon: 'team' },
];

const SIDEBAR_WIDTH = 200;

function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
  const icons: Record<string, ReactNode> = {
    bolt: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    list: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    chart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    team: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    camera: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  };
  return icons[type] || icons.bolt;
}

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
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: 'calc(100vh - 120px)',
        padding: 'var(--space-4)',
        paddingBottom: '80px',
      }}
    >
      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', maxWidth: '500px' }}>
        <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>📷</div>
        <div className="text-body" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
          Loading Camera Mode
        </div>
        <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
          Loading ML models & camera pipeline...
        </div>
        <div style={{ marginTop: 'var(--space-4)', width: '200px', height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--color-brand)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('history');
  const { isInstallable, promptInstall } = usePWAInstall();
  const isDesktop = useMediaQuery(1024);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex' }}>
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside
          style={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            backgroundColor: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 40,
          }}
        >
          <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-mono" style={{ color: 'var(--color-brand)', fontSize: '14px', fontWeight: 700 }}>
              VBT<span style={{ color: 'var(--color-text-muted)' }}>TRACKER</span>
            </span>
          </div>

          <nav style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScreen(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: screen === tab.id ? 'var(--color-brand)' : 'transparent',
                  color: screen === tab.id ? '#000' : 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: screen === tab.id ? 600 : 400,
                  transition: 'background-color 0.15s, color 0.15s',
                  textAlign: 'left',
                  minHeight: '44px',
                }}
              >
                <TabIcon type={tab.icon} active={screen === tab.id} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {isInstallable && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <button onClick={promptInstall} className="btn btn-pill btn-brand" style={{ width: '100%', fontSize: '12px' }}>
                Install App
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Main content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
        minHeight: '100dvh',
      }}>
        {/* PWA Install Banner (mobile only) */}
        {isInstallable && !isDesktop && (
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <div className="flex items-center justify-between" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div>
                <div className="text-caption font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Install VBT Tracker
                </div>
                <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                  Add to home screen for offline use
                </div>
              </div>
              <button onClick={promptInstall} className="btn btn-pill btn-brand" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}>
                Install
              </button>
            </div>
          </div>
        )}

        {/* Screen content */}
        <div style={{ flex: 1, maxWidth: isDesktop ? '960px' : '100%', width: '100%', margin: '0 auto' }}>
          {screen === 'live' && <LiveLiftScreen />}
          {screen === 'camera' && (
            <Suspense fallback={<CameraLoadingSkeleton />}>
              <CameraLiveLiftScreen />
            </Suspense>
          )}
          {screen === 'summary' && <PostSetSummaryScreen />}
          {screen === 'history' && <SessionHistoryScreen />}
          {screen === 'analytics' && <AnalyticsDashboard />}
          {screen === 'athletes' && <AthleteProfilesScreen />}
          {screen === 'coach' && <CoachModeScreen />}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {!isDesktop && (
        <div
          className="fixed bottom-0 left-0 right-0"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border-subtle)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            zIndex: 50,
          }}
        >
          <div className="container">
            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setScreen(tab.id)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    flexDirection: 'column',
                    gap: '4px',
                    borderRadius: 0,
                    color: screen === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    border: 'none',
                    borderBottomWidth: '2px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: screen === tab.id ? 'var(--color-brand)' : 'transparent',
                    minHeight: '60px',
                    transition: 'color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TabIcon type={tab.icon} active={screen === tab.id} />
                  </div>
                  <span className="text-mono" style={{ fontSize: '9px' }}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dev toggle */}
      {import.meta.env.DEV && (
        <select
          onChange={(e) => setScreen(e.target.value as Screen)}
          className="fixed z-50"
          style={{
            top: '4px',
            right: '4px',
            padding: '4px 8px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
          <option value="summary">SUMMARY (old)</option>
        </select>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
