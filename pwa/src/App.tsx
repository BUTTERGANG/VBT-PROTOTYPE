// src/App.tsx

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveLiftScreen } from './components/LiveLiftScreen';
import { PostSetSummaryScreen } from './components/PostSetSummaryScreen';
import { SessionHistoryScreen } from './components/SessionHistoryScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AthleteProfilesScreen } from './components/AthleteProfilesScreen';
import { CoachModeScreen } from './components/CoachModeScreen';
import { usePWAInstall } from './hooks/usePWAInstall';

type Screen = 'live' | 'summary' | 'history' | 'analytics' | 'athletes' | 'coach';

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'live', label: 'LIFT', icon: 'bolt' },
  { id: 'history', label: 'HISTORY', icon: 'list' },
  { id: 'analytics', label: 'STATS', icon: 'chart' },
  { id: 'coach', label: 'COACH', icon: 'users' },
  { id: 'athletes', label: 'TEAM', icon: 'team' },
];

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
  };
  return icons[type] || icons.bolt;
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('history');
  const { isInstallable, promptInstall } = usePWAInstall();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      {/* PWA Install Banner */}
      {isInstallable && (
        <div
          className="fixed top-0 left-0 right-0 z-50"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: 'var(--space-3) var(--space-4)',
          }}
        >
          <div className="flex items-center justify-between" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div>
              <div className="text-caption font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Install VBT Tracker
              </div>
              <div className="text-caption" style={{ color: 'var(--color-text-muted)' }}>
                Add to home screen for offline use
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={promptInstall} className="btn btn-pill btn-brand" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '12px' }}>
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen content */}
      <div style={{ paddingTop: isInstallable ? '60px' : 0 }}>
        {screen === 'live' && <LiveLiftScreen />}
        {screen === 'summary' && <PostSetSummaryScreen />}
        {screen === 'history' && <SessionHistoryScreen />}
        {screen === 'analytics' && <AnalyticsDashboard />}
        {screen === 'athletes' && <AthleteProfilesScreen />}
        {screen === 'coach' && <CoachModeScreen />}
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="container">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScreen(tab.id)}
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  padding: '10px 0',
                  flexDirection: 'column',
                  gap: '4px',
                  borderRadius: 0,
                  color: screen === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  borderBottom: screen === tab.id ? '2px solid var(--color-brand)' : '2px solid transparent',
                }}
              >
                <TabIcon type={tab.icon} active={screen === tab.id} />
                <span className="text-mono" style={{ fontSize: '9px' }}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

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
