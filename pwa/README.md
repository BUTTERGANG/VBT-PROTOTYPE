# VBT Tracker — PWA

Progressive Web App for velocity-based training. Camera-first rep tracking, AI autoregulation, BLE sensor support.

## Development

```bash
npm install
npm run dev       # Dev server → http://localhost:5173
npm run build     # Production build + PWA service worker generation
npm run preview   # Serve production build locally
```

TypeScript check only (no emit):
```bash
npx tsc -b --noEmit
```

## Project Layout

```
src/
├── App.tsx              # Router, layout, tab definitions, install banners
├── index.css            # Design tokens + all shared component classes
├── main.tsx             # Entry point
├── types/index.ts       # Shared TS interfaces (Rep, Session, Athlete, ZoneConfig…)
├── store/
│   └── liftStore.ts     # Zustand global state (velocity, zone, BLE, vision settings)
├── components/          # One file per screen + shared UI components
├── hooks/
│   └── usePWAInstall.ts # Install prompt logic + iOS banner state
├── services/
│   ├── api/client.ts    # Typed REST client (all backend + autoregulate calls)
│   ├── audio/           # FeedbackEngine — beeps and audio zone cues
│   ├── ble/             # BLEManager — Web Bluetooth scanning and data
│   ├── recording/       # SetRecorder, VideoProcessor
│   ├── storage/         # LocalCache — IndexedDB via Dexie (offline storage)
│   └── vision/          # Camera VBT pipeline (TF.js + MediaPipe)
└── utils/
    ├── iosDetection.ts      # iOS capability checks, install banner logic
    ├── oneRMCalculator.ts   # e1RM estimation (M1, M2, M3 models)
    ├── velocityProcessor.ts # Velocity smoothing + filtering
    └── zoneCalculator.ts    # Zone result computation from config
```

## Routing

All routes are defined in `App.tsx`. The default route (`/`) renders the HomeScreen dashboard.

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | HomeScreen | Landing — feature overview, quick stats, quick actions |
| `/camera` | CameraLiveLiftScreen | Lazy-loaded; loads ML models on demand |
| `/live` | LiveLiftScreen | BLE device mirror |
| `/review` | SetReviewScreen | Post-set review; requires prior recording |
| `/workout` | WorkoutScreen | Multi-set builder |
| `/summary` | PostSetSummaryScreen | Calls autoregulate service |
| `/history` | SessionHistoryScreen | Paginated session list |
| `/analytics` | AnalyticsDashboard | Charts; calls backend analytics API |
| `/videos` | VideoLibraryScreen | Calls backend videos API |
| `/athletes` | AthleteProfilesScreen | CRUD; calls backend athletes API |
| `/coach` | CoachModeScreen | Real-time BLE multi-athlete |
| `/settings` | SettingsScreen | Persists to Zustand + localStorage |

## Design System

Design tokens and shared component classes are in `src/index.css`.

### CSS Custom Properties

```css
/* Brand */
--color-brand: #3ecf8e
--color-brand-border: rgba(62, 207, 142, 0.3)

/* Backgrounds */
--color-bg: #171717          /* page background */
--color-bg-deep: #0f0f0f     /* deepest, used for inputs */
--color-surface: #1c1c1c     /* card background */
--color-surface-hover: #242424

/* Text */
--color-text-primary: #fafafa
--color-text-secondary: #b4b4b4
--color-text-muted: #898989
--color-text-faint: #4d4d4d

/* Zone colors — use these everywhere, never hardcode hex */
--zone-in-range: #22c55e
--zone-fast: #ef4444
--zone-slow: #6b7280

/* Semantic */
--color-danger: #ef4444
--color-warning: #eab308
--color-info: #3b82f6
--color-success: #22c55e

/* Typography */
--font-sans: 'Inter', system-ui, ...
--font-mono: 'JetBrains Mono', ...

/* Spacing: --space-1 (4px) through --space-16 (64px) */
/* Radii: --radius-sm (6px) through --radius-pill (9999px) */
```

### Shared Component Classes

| Class | Use |
|-------|-----|
| `.app-input` | All form inputs — focus ring on brand color |
| `.app-input.mono` | Monospace number input |
| `.app-input.lg` | 16px font size variant |
| `.app-label` | Mono uppercase field label |
| `.card` | Standard surface card |
| `.card-glass` | Glassmorphism card variant |
| `.card-error` | Red left-border variant |
| `.card-warning` | Amber left-border variant |
| `.btn` | Base button (min-height 44px) |
| `.btn-brand` | Green fill button |
| `.btn-primary` | Dark fill, white border |
| `.btn-secondary` | Muted border |
| `.btn-ghost` | Transparent, hover background |
| `.btn-discard` | Danger-outlined action |
| `.btn-period` + `.active` | Analytics period selector |
| `.btn-pill` | Pill border-radius modifier |
| `.zone-badge` | Inline colored status pill |
| `.offline-banner` | Amber API-offline warning strip |
| `.toggle` | Sliding toggle (replaces checkbox) |
| `.ble-dot` + `.connected/.error/.idle` | BLE status dot with pulse animation |
| `.skeleton` | Shimmer loading placeholder |
| `.session-card` | History list item with hover |
| `.rep-chart` + `.rep-chart-bar` | Velocity bar chart primitives |
| `.page-header` / `.page-title` / `.page-subtitle` | Consistent screen headers |
| `.screen-container` | Per-screen scroll wrapper (80px bottom padding) |
| `.home-*` | HomeScreen-specific hero, stats, features, workflow |

### Zone Colors

Always use CSS variables — never hardcode zone hex values:

```tsx
// ✓ correct
const color = zone === 'IN_RANGE' ? 'var(--zone-in-range)' : zone === 'FAST' ? 'var(--zone-fast)' : 'var(--zone-slow)';

// ✗ wrong
const color = zone === 'IN_RANGE' ? '#10b981' : ...
```

## State Management

Global state via Zustand in `store/liftStore.ts`:

| State slice | Description |
|-------------|-------------|
| `currentVelocity` / `currentZone` | Live BLE velocity reading |
| `bleState` | `idle` / `connecting` / `connected` / `error` |
| `completedReps` | Reps from most recent recorded set |
| `exercise` | Currently selected exercise name |
| `zoneConfig` | `{ targetVelocity, tolerance }` |
| `visionSettings` | `{ plateDiameterMm, recordingEnabled }` |

Workout sets are persisted in `sessionStorage` (survive navigation, cleared on tab close).

## Offline Support

- All API calls fall back to `LocalCache` (Dexie / IndexedDB) when the backend is unavailable
- Screens show `.offline-banner` when serving cached data
- `SyncIndicator` in the nav shows unsynced record count

## PWA

Install prompt logic is in `hooks/usePWAInstall.ts`:
- Chrome/Android: `beforeinstallprompt` event → install button
- iOS Safari: custom banner with Share → Add to Home Screen instructions
- Both banners appear in the mobile top bar when the app is not yet installed

Service worker is generated by `vite-plugin-pwa` and precaches the full app shell (excluding the 1.2MB vision chunk, which is fetched on demand).

## Browser Compatibility

| Feature | Requirement |
|---------|-------------|
| Camera VBT | Chrome / Safari (any modern) |
| BLE live mode | Chrome on Android or desktop only |
| Video recording | Chrome / Safari with MediaRecorder |
| iOS recording | 20fps cap; `visibilitychange` handling included |
| PWA install | Chrome/Edge (native prompt), iOS Safari (manual) |
