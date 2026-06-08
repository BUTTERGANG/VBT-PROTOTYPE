# VBT Tracker

Velocity Based Training tracker — camera-first PWA with AI autoregulation, BLE sensor support, and full coaching dashboard.

## Project Structure

```
vbt-tracker/
├── pwa/                     # Progressive Web App (Vite + React + TS)
│   ├── public/              # Static assets (PWA icons, manifest, apple-touch-icon)
│   └── src/
│       ├── components/      # 17 screen + utility components
│       │   ├── HomeScreen.tsx             # Landing dashboard with feature cards
│       │   ├── OnboardingScreen.tsx       # 3-step onboarding wizard
│       │   ├── CameraLiveLiftScreen.tsx   # Camera VBT pipeline (lazy-loaded)
│       │   ├── CameraFramingGuide.tsx     # Camera positioning overlay
│       │   ├── LiveLiftScreen.tsx         # BLE live velocity mode
│       │   ├── SetReviewScreen.tsx        # Rep editing, RPE, bar path, e1RM
│       │   ├── WorkoutScreen.tsx          # Multi-set tracking, load-velocity profile
│       │   ├── PostSetSummaryScreen.tsx   # Autoregulation + zone adherence
│       │   ├── SessionHistoryScreen.tsx   # Session list with sync indicator
│       │   ├── AnalyticsDashboard.tsx     # Velocity trends, zone distribution
│       │   ├── VideoLibraryScreen.tsx     # Recorded lift video browser
│       │   ├── AthleteProfilesScreen.tsx  # Athlete CRUD
│       │   ├── CoachModeScreen.tsx        # Multi-athlete live BLE dashboard
│       │   ├── SettingsScreen.tsx         # Zone config, camera prefs
│       │   ├── ZoneConfigPanel.tsx        # Reusable zone config modal
│       │   ├── SyncIndicator.tsx          # Offline sync status dot
│       │   └── ErrorBoundary.tsx
│       ├── hooks/
│       │   └── usePWAInstall.ts           # PWA install prompt + iOS banner
│       ├── services/
│       │   ├── api/client.ts              # REST API client
│       │   ├── audio/FeedbackEngine.ts    # Audio cues
│       │   ├── ble/BLEManager.ts          # Web Bluetooth API
│       │   ├── recording/                 # SetRecorder, VideoProcessor
│       │   ├── storage/LocalCache.ts      # IndexedDB (Dexie)
│       │   └── vision/                    # Camera VBT pipeline
│       │       ├── BarbellDetector.ts
│       │       ├── PoseEstimator.ts
│       │       ├── RepDetector.ts
│       │       ├── VelocityCalculator.ts
│       │       └── VisionManager.ts
│       ├── store/liftStore.ts             # Zustand global state
│       ├── types/index.ts
│       └── utils/
│           ├── iosDetection.ts
│           ├── oneRMCalculator.ts
│           ├── velocityProcessor.ts
│           └── zoneCalculator.ts
├── backend/                 # Node.js + Express API
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   ├── pool.ts       # Neon serverless Postgres (lazy init, graceful missing URL)
│       │   └── schema.sql
│       └── routes/
│           ├── analytics.ts
│           ├── athletes.ts
│           ├── programs.ts
│           ├── sessions.ts
│           └── sync.ts
├── autoregulate/            # Python FastAPI microservice
│   └── main.py              # Fatigue detection, zone adherence, load recommendations
├── firmware/                # nRF52840 firmware reference
│   └── REFERENCE.md
├── SCRUM/                   # Sprint board and backlog
│   ├── CLAUDE.md            # Agent startup protocol
│   ├── Sprint_View.md       # Current sprint status
│   ├── Backlog/             # Task files (sprint + backlog)
│   ├── Working/             # In-progress task files
│   └── Archive/             # Completed task files
├── scripts/
│   ├── generate-replit-ci.sh   # CI generator for Replit projects
│   ├── pre-push.sh             # Pre-push hook
│   └── test-replit-parity.sh   # Docker/Replit parity test
├── .github/workflows/
│   └── replit-parity.yml       # CI: Node 22 + Nix stable-25_05 parity
├── Dockerfile
├── .replit
└── replit.nix
```

## Quick Start

### All Services (Replit)

The `.replit` config starts all three services automatically:

```
autoregulate → http://0.0.0.0:8000
backend      → http://0.0.0.0:3001
pwa (dev)    → http://0.0.0.0:5173
```

### PWA Only

```bash
cd pwa
npm install
npm run dev        # Dev server with HMR
npm run build      # Production build + PWA service worker
npm run preview    # Preview production build
```

### Backend Only

```bash
cd backend
npm install
cp .env.example .env   # Set DATABASE_URL (Neon PostgreSQL)
npm run db:init        # Run schema.sql
npm run dev            # tsx watch
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
| Styling | Tailwind CSS 4 + custom CSS design system |
| Routing | React Router DOM 7 |
| State | Zustand 5 |
| Charts | Recharts 3 + custom SVG |
| BLE | Web Bluetooth API |
| Offline Storage | IndexedDB via Dexie 4 |
| Vision | TensorFlow.js 4 + MediaPipe Tasks Vision |
| PWA | vite-plugin-pwa 1.3 |
| Backend | Node.js + Express 5 + TypeScript |
| Database | Neon Serverless PostgreSQL |
| Autoregulation | Python FastAPI |
| Firmware | nRF52840 (reference) |
| Deployment | Replit |
| CI | GitHub Actions (Node 22 + Nix stable-25_05) |

## PWA Screens

12 routes, responsive layout — mobile bottom tab bar / desktop sidebar:

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | HomeScreen | Landing dashboard — feature cards, quick stats, workflow steps |
| `/camera` | CameraLiveLiftScreen | Camera-based VBT with ML vision pipeline (lazy-loaded) |
| `/live` | LiveLiftScreen | BLE device live velocity mirror |
| `/review` | SetReviewScreen | Rep editing, RPE, bar path overlay, per-rep e1RM |
| `/workout` | WorkoutScreen | Multi-set tracking, quick weight adjust, load-velocity profile |
| `/summary` | PostSetSummaryScreen | Autoregulation API + offline fallback |
| `/history` | SessionHistoryScreen | Past sessions with zone bars, skeleton loading |
| `/analytics` | AnalyticsDashboard | Velocity trend, zone distribution, fatigue alerts |
| `/videos` | VideoLibraryScreen | Recorded lift video browser by exercise |
| `/athletes` | AthleteProfilesScreen | Athlete CRUD with modal form |
| `/coach` | CoachModeScreen | Multi-athlete live BLE velocity dashboard |
| `/settings` | SettingsScreen | Zone config, camera prefs, styled toggle |

## Design System

All design tokens live in `pwa/src/index.css`. Key conventions:

### Zone Color Tokens (single source of truth)
```css
--zone-in-range: #22c55e;
--zone-fast:     #ef4444;
--zone-slow:     #6b7280;
```

### Shared Component Classes
| Class | Purpose |
|-------|---------|
| `.app-input` | Form inputs — focus ring, border, background |
| `.app-label` | Mono uppercase field labels |
| `.offline-banner` | Warning strip for offline / API error states |
| `.zone-badge` | Inline colored status pill (IN ZONE / FAST / SLOW) |
| `.btn-period` + `.active` | Analytics period selector buttons |
| `.toggle` | Sliding toggle switch (replaces browser checkbox) |
| `.ble-dot` | BLE status indicator with pulse animation when connected |
| `.skeleton` | Shimmer loading placeholder |
| `.session-card` | History list card with hover state |
| `.rep-chart` + `.rep-chart-bar` | Velocity bar chart primitives |
| `.btn-discard` | Danger-outlined discard button |
| `.card-error` / `.card-warning` | Card left-border state variants |
| `.home-*` | HomeScreen hero, stats, feature grid, workflow strip |

### Navigation Active State
- **Desktop sidebar:** `border-left: 2px solid brand` + brand tint background
- **Mobile tab bar:** `border-bottom: 2px solid brand` + brand text color

## Autoregulation API

`autoregulate/main.py` — Python FastAPI service on port 8000:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `POST /api/autoregulate` | Analyze set data → fatigue detection, zone adherence, load recommendations |

Response includes per-set recommendations (`increase_load` / `decrease_load` / `maintain` / `stop`), confidence scores, velocity drop %, and an overall session summary.

## Backend API

Node.js + Express on port 3001. DB pool initializes lazily — starts without `DATABASE_URL` and returns 503 on DB routes until one is set.

| Route | Description |
|-------|-------------|
| `GET/POST /api/athletes` | Athlete CRUD |
| `GET/POST /api/sessions` | Session CRUD |
| `GET /api/analytics` | Dashboard analytics queries |
| `GET/POST /api/programs` | Training program management |
| `POST /api/sync` | Offline sync endpoint |

## Build Output

```
dist/registerSW.js            0.13 kB
dist/manifest.webmanifest     0.41 kB
dist/index.html               1.22 kB
dist/assets/index.css        ~27 kB gzip: ~6 kB
dist/assets/index.js         ~443 kB gzip: ~129 kB   (app shell)
dist/assets/CameraLiveLift   ~38 kB gzip: ~10 kB     (lazy camera chunk)
dist/assets/VisionManager    ~1.2 MB gzip: ~301 kB   (TF.js + MediaPipe)
```

## CI / Docker

The GitHub Actions workflow (`.github/workflows/replit-parity.yml`) runs on Node 22 + Nix `stable-25_05` to match the Replit environment. It builds the PWA, typechecks the backend, and runs a Docker parity test via `scripts/test-replit-parity.sh`.

## SCRUM Board

Sprint tasks live in `SCRUM/`. See `SCRUM/Sprint_View.md` for current sprint status and `SCRUM/Backlog/` for upcoming work. Agent protocol is defined in `SCRUM/CLAUDE.md`.

## Reference Repos

- [squatsandsciencelabs/OpenBarbell-V3](https://github.com/squatsandsciencelabs/OpenBarbell-V3) — Primary firmware reference
- [makerdiary/nrf52840-mdk](https://github.com/makerdiary/nrf52840-mdk) — nRF52840 dev kit
- [tlancon/barbellcv](https://github.com/tlancon/barbellcv) — Camera VBT reference
- [GoogleChromeLabs/web-bluetooth-samples](https://github.com/GoogleChromeLabs/web-bluetooth-samples) — Web Bluetooth API

## License

MIT
