# VBT Tracker

Velocity Based Training tracker — low-cost ($8–12 BOM) device with PWA dashboard.

## Project Structure

```
vbt-tracker/
├── pwa/                     # Progressive Web App (Vite + React + TS)
│   ├── public/              # Static assets (PWA icons, manifest)
│   ├── src/
│   │   ├── components/      # Screen components (16 total)
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── AthleteProfilesScreen.tsx
│   │   │   ├── CameraFramingGuide.tsx
│   │   │   ├── CameraLiveLiftScreen.tsx   # Lazy-loaded (vision pipeline)
│   │   │   ├── CoachModeScreen.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LiveLiftScreen.tsx         # BLE live mode
│   │   │   ├── OnboardingScreen.tsx       # 3-step onboarding
│   │   │   ├── PostSetSummaryScreen.tsx
│   │   │   ├── SessionHistoryScreen.tsx
│   │   │   ├── SetReviewScreen.tsx        # Rep editing, RPE, bar path
│   │   │   ├── SettingsScreen.tsx
│   │   │   ├── SyncIndicator.tsx
│   │   │   ├── VideoLibraryScreen.tsx
│   │   │   ├── WorkoutScreen.tsx          # Multi-set, load-velocity profile
│   │   │   └── ZoneConfigPanel.tsx
│   │   ├── hooks/
│   │   │   └── usePWAInstall.ts
│   │   ├── services/
│   │   │   ├── api/
│   │   │   │   └── client.ts             # REST API client
│   │   │   ├── audio/
│   │   │   │   └── FeedbackEngine.ts     # Audio cues
│   │   │   ├── ble/
│   │   │   │   └── BLEManager.ts         # Web Bluetooth API service
│   │   │   ├── recording/
│   │   │   │   ├── SetRecorder.ts
│   │   │   │   └── VideoProcessor.ts
│   │   │   ├── storage/
│   │   │   │   └── LocalCache.ts         # IndexedDB local cache (Dexie)
│   │   │   └── vision/                   # Camera-based VBT pipeline
│   │   │       ├── BarbellDetector.ts
│   │   │       ├── PoseEstimator.ts
│   │   │       ├── RepDetector.ts
│   │   │       ├── VelocityCalculator.ts
│   │   │       ├── VisionManager.ts
│   │   │       ├── exerciseConfigs.ts
│   │   │       ├── index.ts
│   │   │       ├── liftingModes.ts
│   │   │       └── types.ts
│   │   ├── store/
│   │   │   └── liftStore.ts              # Zustand state management
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── iosDetection.ts           # iOS PWA detection & install banner
│   │       ├── oneRMCalculator.ts
│   │       ├── velocityProcessor.ts
│   │       └── zoneCalculator.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── ...
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── pool.ts       # Neon serverless Postgres connection
│   │   │   └── schema.sql    # Database schema
│   │   └── routes/
│   │       ├── analytics.ts
│   │       ├── athletes.ts
│   │       ├── programs.ts
│   │       ├── sessions.ts
│   │       └── sync.ts
│   └── ...
├── autoregulate/            # Python FastAPI autoregulation microservice
│   └── main.py              # Fatigue detection, zone adherence, load recommendations
├── firmware/                # nRF52840 firmware reference
│   └── REFERENCE.md
├── docs/                    # Project documentation
├── .replit                  # Replit deployment config
├── replit.nix               # Replit Nix environment
└── README.md
```

## Quick Start

### PWA

```bash
cd pwa
npm install
npm run dev
```

Build for production:
```bash
npm run build
npm run preview
```

### Backend

```bash
cd backend
npm install

# Set up Neon PostgreSQL, then:
cp .env.example .env  # Configure DATABASE_URL
npm run db:init        # Run schema.sql against your DB
npm run dev
```

### Autoregulation Service

```bash
cd autoregulate
pip install fastapi uvicorn pydantic
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| PWA | Vite 8 + React 19 + TypeScript 6 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| State | Zustand 5 |
| Charts | Recharts 3 |
| BLE | Web Bluetooth API |
| Offline Storage | IndexedDB (Dexie 4) |
| Vision | TensorFlow.js 4 + MediaPipe Tasks Vision |
| PWA | vite-plugin-pwa |
| Backend | Node.js + Express 5 + TypeScript |
| Database | Neon Serverless PostgreSQL |
| Autoregulation | Python FastAPI |
| Firmware | nRF52840 (reference) |
| Deployment | Replit (PWA + Backend) |

## PWA Screens

The app uses `react-router-dom` with 11 screens and a responsive layout (mobile tab bar / desktop sidebar):

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Redirect | → `/history` |
| `/camera` | CameraLiveLiftScreen | Camera-based VBT with ML vision pipeline (lazy-loaded) |
| `/live` | LiveLiftScreen | BLE device live velocity mode |
| `/review` | SetReviewScreen | Rep editing, RPE, bar path toggle, e1RM per-rep |
| `/workout` | WorkoutScreen | Multi-set tracking, load-velocity profile, sessionStorage persistence |
| `/summary` | PostSetSummaryScreen | Autoregulation API + offline fallback |
| `/history` | SessionHistoryScreen | Past sessions with sync indicator |
| `/analytics` | AnalyticsDashboard | Stats and trends |
| `/videos` | VideoLibraryScreen | Recorded lift videos |
| `/athletes` | AthleteProfilesScreen | Athlete management |
| `/coach` | CoachModeScreen | Coach dashboard |
| `/settings` | SettingsScreen | App configuration |

### Key Features
- **3-step onboarding** with profile setup
- **Camera-first VBT** with barbell detection, pose estimation, rep detection
- **BLE live mode** via Web Bluetooth API
- **Offline support** with IndexedDB (Dexie) and sync indicator
- **iOS PWA** support with manual install banner, 20fps MediaRecorder, visibilitychange handling
- **Session persistence** via sessionStorage (survives navigation, cleared on tab close)
- **Error boundary** wrapping the entire app
- **Screen transitions** (fade-up animation)
- **Responsive layout**: mobile bottom tab bar (5 tabs + gear) / desktop sidebar (all tabs)

## Autoregulation API

The Python FastAPI service (`autoregulate/`) provides velocity-based training recommendations:

- **Fatigue detection** — velocity drop analysis within sets
- **Zone adherence** — % of reps hitting target velocity zone
- **Load recommendations** — increase / decrease / maintain / stop per set
- **Overall session summary** — aggregate stats and confidence scoring

Endpoints:
- `GET /api/health` — Health check
- `POST /api/autoregulate` — Analyze session data, get recommendations

## Backend API Routes

| Route | Description |
|-------|-------------|
| `/api/athletes` | Athlete CRUD |
| `/api/sessions` | Session CRUD |
| `/api/analytics` | Analytics queries |
| `/api/programs` | Training program management |
| `/api/sync` | Offline sync endpoint |

## Build Output

Production build splits into:
- `main.js` — 381 KB (app shell, routing, screens)
- `camera.js` — 38 KB (CameraLiveLiftScreen chunk)
- `vision.js` — 1.2 MB (TensorFlow.js + MediaPipe)

## Reference Repos

- [squatsandsciencelabs/OpenBarbell-V3](https://github.com/squatsandsciencelabs/OpenBarbell-V3) — Primary firmware reference
- [makerdiary/nrf52840-mdk](https://github.com/makerdiary/nrf52840-mdk) — nRF52840 dev kit
- [tlancon/barbellcv](https://github.com/tlancon/barbellcv) — Camera VBT reference
- [web-bluetooth-samples](https://github.com/GoogleChromeLabs/web-bluetooth-samples) — Web Bluetooth API examples

## License

MIT
