// src/components/OnboardingScreen.tsx

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
          <span style={{ fontSize: '40px', fontWeight: 900, color: 'var(--color-brand)', fontFamily: 'var(--font-mono)' }}>
            VBT
          </span>
          <span style={{ fontSize: '40px', fontWeight: 300, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            TRACKER
          </span>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 'var(--space-5)' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              backgroundColor: i === step ? 'var(--color-brand)' : 'var(--color-border)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🏋️</div>
            <h1 style={{ color: 'var(--color-text-primary)', fontSize: '24px', margin: '0 0 var(--space-2) 0' }}>
              Track velocity. Train smarter.
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 var(--space-5) 0' }}>
              VBT Tracker uses your phone's camera to measure barbell velocity in real-time — no hardware needed.
            </p>
            <button
              onClick={() => setStep(1)}
              className="btn btn-pill btn-brand"
              style={{ width: '100%', padding: 'var(--space-3)', fontSize: '16px' }}
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--color-text-primary)', fontSize: '20px', margin: '0 0 var(--space-4) 0' }}>
              Create your profile
            </h2>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ color: 'var(--color-text-muted)', fontSize: '12px', display: 'block', marginBottom: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>
                NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)',
                  fontSize: '16px', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label style={{ color: 'var(--color-text-muted)', fontSize: '12px', display: 'block', marginBottom: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>
                BODYWEIGHT (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={bodyweight}
                onChange={(e) => setBodyweight(e.target.value)}
                placeholder="75.0"
                style={{
                  width: '100%', padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)',
                  fontSize: '16px', fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
              <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: 'var(--space-1)' }}>
                Enables relative strength & power tracking
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setStep(0)}
                className="btn btn-pill btn-secondary"
                style={{ padding: 'var(--space-3)' }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="btn btn-pill btn-brand"
                style={{ flex: 1, padding: 'var(--space-3)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Lift selection */}
        {step === 2 && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--color-text-primary)', fontSize: '20px', margin: '0 0 var(--space-2) 0' }}>
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
                      padding: '6px 14px',
                      borderRadius: '999px',
                      border: `1px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      backgroundColor: isSelected ? 'var(--color-brand)' : 'transparent',
                      color: isSelected ? '#000' : 'var(--color-text-muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lift}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setStep(1)}
                className="btn btn-pill btn-secondary"
                style={{ padding: 'var(--space-3)' }}
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="btn btn-pill btn-brand"
                style={{ flex: 1, padding: 'var(--space-3)', fontSize: '16px' }}
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
