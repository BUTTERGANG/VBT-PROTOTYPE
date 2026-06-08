import { useState } from 'react';

interface OnboardingScreenProps {
  onComplete: (profile: { name: string; bodyweight: number; primaryLifts: string[] }) => void;
}

const LIFT_OPTIONS = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Front Squat', 'Incline Bench', 'Power Clean'];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [bodyweight, setBodyweight] = useState('');
  const [selectedLifts, setSelectedLifts] = useState<string[]>(['Squat', 'Bench Press', 'Deadlift']);

  const toggleLift = (lift: string) => {
    setSelectedLifts(prev =>
      prev.includes(lift) ? prev.filter(l => l !== lift) : [...prev, lift]
    );
  };

  const handleComplete = () => {
    onComplete({
      name: name.trim() || 'Athlete',
      bodyweight: parseFloat(bodyweight) || 75,
      primaryLifts: selectedLifts,
    });
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--color-brand)', fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>VBT</span>
          <span style={{ fontSize: '36px', fontWeight: 300, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>TRACKER</span>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? '28px' : '8px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: i < step ? 'var(--color-brand)' : i === step ? 'var(--color-brand)' : 'var(--color-border)',
              opacity: i < step ? 0.5 : 1,
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', backgroundColor: 'rgba(62,207,142,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h1 style={{ color: 'var(--color-text-primary)', fontSize: '22px', fontWeight: 500, margin: '0 0 var(--space-2) 0', lineHeight: 1.3 }}>
              Track velocity.<br />Train smarter.
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 var(--space-6) 0' }}>
              VBT Tracker uses your phone's camera to measure barbell velocity in real-time — no hardware needed.
            </p>
            <button onClick={() => setStep(1)} className="btn btn-pill home-cta-primary" style={{ width: '100%' }}>
              Get Started
            </button>
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 500, margin: '0 0 var(--space-5) 0' }}>
              Create your profile
            </h2>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="app-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="app-input lg"
              />
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label className="app-label">Bodyweight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={bodyweight}
                onChange={(e) => setBodyweight(e.target.value)}
                placeholder="75.0"
                className="app-input mono lg"
              />
              <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: 'var(--space-1)' }}>
                Enables relative strength &amp; power tracking
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setStep(0)} className="btn btn-pill btn-secondary" style={{ padding: 'var(--space-3) var(--space-5)' }}>
                Back
              </button>
              <button onClick={() => setStep(2)} className="btn btn-pill home-cta-primary" style={{ flex: 1 }}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Lift selection */}
        {step === 2 && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--color-text-primary)', fontSize: '18px', fontWeight: 500, margin: '0 0 var(--space-1) 0' }}>
              What do you train?
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 var(--space-4) 0' }}>
              Select your primary lifts for quick access
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
              {LIFT_OPTIONS.map(lift => {
                const isSelected = selectedLifts.includes(lift);
                return (
                  <button
                    key={lift}
                    onClick={() => toggleLift(lift)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: `1px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      backgroundColor: isSelected ? 'rgba(62,207,142,0.15)' : 'transparent',
                      color: isSelected ? 'var(--color-brand)' : 'var(--color-text-muted)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      minHeight: '36px',
                    }}
                  >
                    {lift}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setStep(1)} className="btn btn-pill btn-secondary" style={{ padding: 'var(--space-3) var(--space-5)' }}>
                Back
              </button>
              <button
                onClick={handleComplete}
                className="btn btn-pill home-cta-primary"
                style={{ flex: 1 }}
                disabled={selectedLifts.length === 0}
              >
                Start Training
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
