import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Dexie from 'dexie';

interface QuickStat {
  label: string;
  value: string;
  unit?: string;
}

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
  path: string;
  accent: string;
}

function useSessionStats() {
  const [stats, setStats] = useState<QuickStat[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = new Dexie('VBTTrackerDB');
        db.version(1).stores({ sessions: 'id,timestamp,exercise' });
        const count = await db.table('sessions').count();
        const all = await db.table('sessions').toArray();
        let bestVel = 0;
        let totalSets = 0;
        for (const s of all) {
          if (s.bestVelocity > bestVel) bestVel = s.bestVelocity;
          if (Array.isArray(s.sets)) totalSets += s.sets.length;
          else if (Array.isArray(s.reps)) totalSets += 1;
        }
        if (count > 0) {
          setStats([
            { label: 'Sessions', value: String(count) },
            { label: 'Best Velocity', value: bestVel > 0 ? bestVel.toFixed(2) : '—', unit: bestVel > 0 ? 'm/s' : undefined },
            { label: 'Sets Logged', value: totalSets > 0 ? String(totalSets) : String(count) },
          ]);
        }
      } catch {
        // DB not available or empty — stats stay null
      }
    })();
  }, []);

  return stats;
}

const FEATURES: Feature[] = [
  {
    accent: '#3ecf8e',
    title: 'Computer Vision',
    desc: 'AI-powered rep counting with barbell tracking. No hardware sensors required — just your phone camera.',
    path: '/camera',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  },
  {
    accent: '#3b82f6',
    title: 'Velocity Zones',
    desc: 'Train in your optimal speed zone. Real-time audio and visual feedback keeps every rep precise.',
    path: '/settings',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    accent: '#a855f7',
    title: 'Auto-Regulation',
    desc: 'AI load recommendations that adapt to your daily readiness. Stop guessing, start optimizing.',
    path: '/summary',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10"/>
        <path d="M12 6v6l4 2"/>
        <path d="M22 2l-5 5"/>
        <path d="M17 2h5v5"/>
      </svg>
    ),
  },
  {
    accent: '#eab308',
    title: 'Deep Analytics',
    desc: 'Velocity trends, 1RM estimates, and fatigue alerts. The full picture of your training over time.',
    path: '/analytics',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    accent: '#ef4444',
    title: 'Coach Mode',
    desc: 'Monitor multiple athletes simultaneously with live BLE velocity streams on one dashboard.',
    path: '/coach',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    accent: '#06b6d4',
    title: 'BLE Sensors',
    desc: 'Pair wireless velocity sensors for hardware-grade precision alongside or instead of camera mode.',
    path: '/live',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
        <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>
      </svg>
    ),
  },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const stats = useSessionStats();
  const hasStats = stats !== null;

  return (
    <div className="home-screen">
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-glow" />
        <div className="home-hero-inner">
          <div className="home-wordmark">
            <span className="home-wordmark-vbt">VBT</span>
            <span className="home-wordmark-tracker">TRACKER</span>
          </div>
          <h1 className="home-headline">
            Train smarter.<br />
            <span className="home-headline-accent">Lift faster.</span>
          </h1>
          <p className="home-subhead">
            Velocity-based training for serious athletes. Real-time feedback, AI load
            regulation, and deep analytics — from your phone or a BLE sensor.
          </p>
          <div className="home-cta-row">
            <button
              className="btn btn-pill home-cta-primary"
              onClick={() => navigate('/camera')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Start Session
            </button>
            <button
              className="btn btn-pill home-cta-secondary"
              onClick={() => navigate('/history')}
            >
              View History
            </button>
          </div>
        </div>

        {/* Velocity zone decorative bars */}
        <div className="home-zone-bars" aria-hidden>
          {[
            { color: '#ef4444', h: 40, delay: '0s' },
            { color: '#ef4444', h: 56, delay: '0.08s' },
            { color: '#eab308', h: 72, delay: '0.16s' },
            { color: '#22c55e', h: 96, delay: '0.24s' },
            { color: '#22c55e', h: 112, delay: '0.32s' },
            { color: '#22c55e', h: 88, delay: '0.40s' },
            { color: '#3ecf8e', h: 64, delay: '0.48s' },
            { color: '#eab308', h: 48, delay: '0.56s' },
            { color: '#ef4444', h: 36, delay: '0.64s' },
          ].map((bar, i) => (
            <div
              key={i}
              className="home-zone-bar"
              style={{ height: bar.h, backgroundColor: bar.color, animationDelay: bar.delay }}
            />
          ))}
        </div>
      </section>

      {/* ── Quick stats (only when data exists) ── */}
      {hasStats && (
        <section className="home-stats-section">
          <div className="home-stats-grid">
            {stats!.map((s) => (
              <div key={s.label} className="home-stat-card">
                <div className="home-stat-value">
                  {s.value}
                  {s.unit && <span className="home-stat-unit">{s.unit}</span>}
                </div>
                <div className="home-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Features grid ── */}
      <section className="home-features-section">
        <div className="home-section-header">
          <span className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>PLATFORM</span>
          <h2 className="home-section-title">Everything you need to train at your best</h2>
        </div>

        <div className="home-features-grid">
          {FEATURES.map((f) => (
            <button
              key={f.title}
              className="home-feature-card"
              onClick={() => navigate(f.path)}
              style={{ '--feature-accent': f.accent } as React.CSSProperties}
            >
              <div className="home-feature-icon" style={{ color: f.accent, backgroundColor: `${f.accent}18` }}>
                {f.icon}
              </div>
              <div>
                <div className="home-feature-title">{f.title}</div>
                <div className="home-feature-desc">{f.desc}</div>
              </div>
              <div className="home-feature-arrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Workflow strip ── */}
      <section className="home-workflow-section">
        <div className="home-section-header">
          <span className="text-mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>HOW IT WORKS</span>
          <h2 className="home-section-title">From first rep to full analysis</h2>
        </div>
        <div className="home-workflow-steps">
          {[
            { n: '01', title: 'Record', desc: 'Point your camera at the bar and start lifting. Vision AI tracks every rep.' },
            { n: '02', title: 'Review', desc: 'See velocity curves, remove false reps, and confirm your set data.' },
            { n: '03', title: 'Regulate', desc: 'Get AI-powered load suggestions based on your velocity drop and fatigue.' },
            { n: '04', title: 'Analyze', desc: 'Track trends, 1RM estimates, and zone compliance across sessions.' },
          ].map((step, i, arr) => (
            <div key={step.n} className="home-step">
              <div className="home-step-number">{step.n}</div>
              <div className="home-step-content">
                <div className="home-step-title">{step.title}</div>
                <div className="home-step-desc">{step.desc}</div>
              </div>
              {i < arr.length - 1 && <div className="home-step-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="home-bottom-cta">
        <div className="home-bottom-cta-inner">
          <h2 className="home-section-title" style={{ marginBottom: 'var(--space-2)' }}>Ready to train with data?</h2>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
            Start a session now — no account or equipment required.
          </p>
          <button className="btn btn-pill home-cta-primary" onClick={() => navigate('/camera')}>
            Start Your First Set
          </button>
        </div>
      </section>
    </div>
  );
}
