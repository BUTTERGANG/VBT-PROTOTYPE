// src/components/CameraFramingGuide.tsx

interface CameraFramingGuideProps {
  exerciseCategory: string;
  onDismiss: () => void;
}

const TIPS_BY_CATEGORY: Record<string, { height: string; extras?: string }> = {
  squat:    { height: 'Waist height (mid-movement)' },
  bench:    { height: 'Bench height or slightly below', extras: 'Keep full ROM in frame — from unrack to chest touch' },
  deadlift: { height: 'Floor to waist — frame from ground to lockout' },
  overhead: { height: 'Chest/shoulder height — higher than squats', extras: 'Must see full overhead lockout in frame' },
  clean:    { height: 'Waist height', extras: 'Use Mode 2 or 3 if bar speed exceeds 1.25 m/s' },
  row:      { height: 'Waist height' },
};

export function CameraFramingGuide({ exerciseCategory, onDismiss }: CameraFramingGuideProps) {
  const tips = TIPS_BY_CATEGORY[exerciseCategory] || TIPS_BY_CATEGORY.squat;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.82)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
      zIndex: 50,
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '340px', width: '100%' }}>
        {/* Frame illustration */}
        <div style={{
          width: '160px',
          height: '280px',
          border: '2px solid rgba(16,185,129,0.5)',
          borderRadius: '16px',
          position: 'relative',
          margin: '0 auto var(--space-4)',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}>
          {/* Corner brackets */}
          {[
            { top: 0, left: 0, borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981' },
            { top: 0, right: 0, borderTop: '3px solid #10b981', borderRight: '3px solid #10b981' },
            { bottom: 0, left: 0, borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981' },
            { bottom: 0, right: 0, borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: '18px', height: '18px', ...s }} />
          ))}

          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', opacity: 0.7 }}>🏋️</div>
          </div>

          {/* Portrait label */}
          <div style={{
            position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#10b981',
            backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            PORTRAIT MODE
          </div>

          {/* Plate-in-frame warning */}
          <div style={{
            position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#f59e0b',
            backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            PLATE IN FRAME = VELOCITY
          </div>
        </div>

        {/* Tips card */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-3)',
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-brand)', marginBottom: '2px' }}>
            CAMERA SETUP
          </div>

          <Row label="Side" text="Film from the side, 0–30° from the bar end" />
          <Row label="Distance" text="Any distance is fine — just keep the full plate in frame" />
          <Row label="Height" text={tips.height} />
          <Row label="Mount" text="Tripod or stable surface — handheld degrades accuracy" />
          <Row label="Lighting" text="Avoid dark plates in dim rooms; avoid bright backlight near bar" />

          {tips.extras && (
            <div>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Note: </span>{tips.extras}
            </div>
          )}

          <div style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'rgba(245,158,11,0.08)',
            borderLeft: '3px solid #f59e0b',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            fontSize: '12px',
            color: '#f59e0b',
          }}>
            Keep the full weight plate visible throughout the entire set. Velocity is 0.00 until the plate is detected — it locks on automatically.
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-3)', fontSize: '14px' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Row({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <span style={{ color: '#10b981', fontWeight: 600 }}>{label}: </span>{text}
    </div>
  );
}
