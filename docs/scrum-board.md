# VBT Tracker — Scrum Board

## Sprint Status

### Sprint 1 — PWA Scaffold & Boilerplate ✅
- Vite + React + TypeScript + Tailwind + PWA plugin
- Folder structure, manifest, service worker
- PWA install prompt + iOS manual install banner
- Responsive layout (mobile tab bar / desktop sidebar)
- Error boundary wrapper

### Sprint 2 — Web Bluetooth BLE Layer ✅
- BLEManager service with Web Bluetooth API
- LiveLiftScreen with real-time velocity display
- Local storage fallback with IndexedDB (Dexie)
- Circular buffer for pre-rep data
- Velocity processor (rolling average, outlier rejection)

### Sprint 3 — Core Lift UI ✅
- LiveLiftScreen with giant velocity number
- Zone-based background coloring (green/yellow/red)
- PostSetSummaryScreen with rep table, fatigue detection, autoregulation
- ZoneConfigPanel for velocity zone configuration

### Sprint 4 — Camera VBT Pipeline ✅
- CameraLiveLiftScreen with lazy loading
- Vision pipeline: BarbellDetector, PoseEstimator, RepDetector, VelocityCalculator
- TensorFlow.js + MediaPipe Tasks Vision integration
- CameraFramingGuide overlay
- Video recording via MediaRecorder API (20fps on iOS)
- SetRecorder + VideoProcessor services
- Upload mode for pre-recorded videos

### Sprint 5 — Workout Flow & Review ✅
- OnboardingScreen (3-step profile setup)
- SetReviewScreen: false rep removal, edit set, RPE, bar path toggle, e1RM per-rep
- WorkoutScreen: multi-set tracking, load-velocity profile, sessionStorage persistence
- Screen transitions (fade-up animation)
- Audio feedback engine

### Sprint 6 — Backend & Data ✅
- Node.js + Express REST API
- Neon serverless PostgreSQL integration
- Schema: athletes, sessions, programs, analytics, sync
- API client service in PWA
- SyncIndicator component

### Sprint 7 — Autoregulation Service ✅
- Python FastAPI microservice
- Fatigue detection (velocity drop analysis)
- Zone adherence scoring
- Per-set load recommendations (increase/decrease/maintain/stop)
- Overall session summary with confidence scoring
- Offline fallback in PostSetSummaryScreen

### Sprint 8 — Polish & Extended Screens ✅
- AnalyticsDashboard
- SessionHistoryScreen
- AthleteProfilesScreen
- CoachModeScreen
- VideoLibraryScreen
- SettingsScreen
- iOS PWA optimizations (visibilitychange, safe-area-inset)

---

## Current Backlog

### In Progress
- [ ] Replit deployment for HTTPS phone testing
- [ ] End-to-end camera VBT testing on physical device

### Next Up
- [ ] Firmware development (nRF52840 BLE + IMU)
- [ ] BLE device pairing flow in PWA
- [ ] Real sensor data integration with LiveLiftScreen
- [ ] Load-velocity profile calibration per athlete
- [ ] Export session data (CSV / PDF)
- [ ] Dark/light theme toggle

### Backlog
- [ ] Multi-athlete session support (coach view)
- [ ] Training program builder
- [ ] Progressive overload tracking across sessions
- [ ] PR/achievement notifications
- [ ] Bar path visualization overlay on recorded video
- [ ] Video playback with velocity overlay
- [ ] Unit tests (vitest + React Testing Library)
- [ ] E2E tests (Playwright)

### Icebox (Post-MVP)
- [ ] Wearable integration (heart rate)
- [ ] AI load recommendations (beyond rule-based autoregulation)
- [ ] Social / leaderboard features
- [ ] Apple Watch companion app
- [ ] Gym fleet management dashboard
- [ ] Barbell velocity calibration wizard
- [ ] Multi-exercise workout templates
- [ ] Integration with popular training apps (Strong, Hevy)

---

## Architecture Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| React Router DOM over useState routing | Done | Enables deep linking, browser back/forward |
| Zustand for state management | Done | Lightweight, no boilerplate |
| Lazy-load camera screen | Done | 1.2MB vision chunk only loaded when needed |
| sessionStorage for workout persistence | Done | Survives navigation, cleared on tab close |
| Neon serverless Postgres | Done | Auto-scales, no connection pooling issues |
| FastAPI autoregulation microservice | Done | Separate from main backend for ML flexibility |
| Tailwind CSS 4 | Done | CSS-native, no PostCSS pipeline |
| Vite PWA plugin | Done | Auto-generates SW, manifest, icons |
