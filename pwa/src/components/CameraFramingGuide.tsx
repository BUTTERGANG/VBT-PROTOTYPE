// src/components/CameraFramingGuide.tsx

/**
 * Overlay shown on the camera setup screen with positioning guidelines.
 * Based on Metric.coach's best practices for camera-based VBT.
 */

interface CameraFramingGuideProps {
  exerciseCategory: string;
  onDismiss: () => void;
}

const TIPS_BY_CATEGORY: Record<string, { position: string; height: string; extras?: string }> = {
  squat: { position: 'Side-on to the barbell, within 25° of bar end', height: 'Waist height' },
  bench: { position: 'Side-on, perpendicular to the bench', height: 'Bench height or slightly below', extras: 'Keep the full ROM in frame from unrack to chest' },
  deadlift: { position: 'Side-on to the barbell', height: 'Waist height', extras: 'Frame from floor to lockout' },
  overhead: { position: 'Side-on to the barbell', height: 'Chest/shoulder height — higher than squats', extras: 'Need to see full overhead lockout' },
  clean: { position: 'Side-on to the barbell', height: 'Waist height', extras: 'Use Mode 2 or 3 if velocity > 1.25 m/s' },
  row: { position: 'Side-on to the barbell', height: 'Waist height' },
};

export function CameraFramingGuide({ exerciseCategory, onDismiss }: CameraFramingGuideProps) {
  const tips = TIPS_BY_CATEGORY[exerciseCategory] || TIPS_BY_CATEGORY.squat;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
      zIndex: 30,
    }}>
      {/* Camera frame illustration */}
      <div style={{
        width: '240px',
        height: '180px',
        border: '2px solid rgba(16,185,129,0.5)',
        borderRadius: '8px',
        position: 'relative',
        marginBottom: 'var(--space-4)',
      }}>
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '3px solid #10b981', borderRight: '3px solid #10b981' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981' }} />

        {/* Stick figure representation */}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', opacity: 0.6 }}>🏋️</div>
        </div>

        {/* "Keep in frame" label */}
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#10b981',
          backgroundColor: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px',
        }}>
          KEEP FULL ROM IN FRAME
        </div>
      </div>

      {/* Tips */}
      <div style={{ maxWidth: '320px', width: '100%' }}>
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-3)',
        }}>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-brand)', marginBottom: 'var(--space-3)' }}>
            SETUP TIPS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            <div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Position:</span> {tips.position}
            </div>
            <div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Height:</span> {tips.height}
            </div>
            {tips.extras && (
              <div>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Note:</span> {tips.extras}
              </div>
            )}
            <div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Stability:</span> Tripod or stable surface — handheld recording reduces accuracy
            </div>
            <div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Lighting:</span> Avoid dark plates in dark rooms; avoid bright backlight near the bar
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="btn btn-pill btn-brand"
          style={{ width: '100%', padding: 'var(--space-3)', fontSize: '14px' }}
        >
          Got it — Ready to Record
        </button>
      </div>
    </div>
  );
}
