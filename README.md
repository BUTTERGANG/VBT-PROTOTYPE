# VBT Tracker

Velocity Based Training tracker — low-cost ($8–12 BOM) device with PWA dashboard.

## Project Structure

```
vbt-tracker/
├── pwa/                  # Progressive Web App (Vite + React + TS)
│   ├── src/
│   │   ├── components/   # UI components (LiveLiftScreen, PostSetSummaryScreen)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Route pages
│   │   ├── services/
│   │   │   ├── ble/      # Web Bluetooth API service
│   │   │   └── storage/  # IndexedDB local cache (Dexie)
│   │   ├── store/        # Zustand state management
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # Velocity processing, zone calculation
│   └── ...
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── db/           # PostgreSQL schema & connection pool
│   │   └── routes/       # REST API routes
│   └── ...
├── firmware/             # nRF52840 firmware reference
├── docs/                 # Project documentation
└── README.md
```

## Quick Start

### PWA

```bash
cd pwa
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install

# Set up PostgreSQL first, then:
cp .env.example .env  # Configure DB credentials
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| PWA | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Charts | Recharts |
| BLE | Web Bluetooth API |
| Offline Storage | IndexedDB (Dexie) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Autoregulation | Python FastAPI (future) |
| Firmware | nRF5 SDK / Zephyr RTOS |

## Scrum Board

See `docs/scrum-board.md` for the full task breakdown.

### Sprint 1 — PWA Scaffold & Boilerplate ✅
- Vite + React + TypeScript + Tailwind + PWA plugin
- Folder structure, manifest, service worker
- PWA install prompt

### Sprint 2 — Web Bluetooth BLE Layer ✅
- BLEManager service with Web Bluetooth API
- Local storage fallback with IndexedDB
- Circular buffer for pre-rep data
- Velocity processor (rolling average, outlier rejection)

### Sprint 3 — Core Lift UI ✅
- LiveLiftScreen with giant velocity number
- Zone-based background coloring (green/yellow/red)
- PostSetSummaryScreen with rep table, fatigue detection, autoregulation

### Backlog
- Athlete profile setup
- Exercise selector
- Session history
- 1RM calculator
- Settings screen
- Offline sync indicator

### Icebox (Post-MVP)
- iOS app
- Bar path visualization
- Leaderboard / gamification
- Coach dashboard
- Wearable integration
- AI load recommendations

## Reference Repos

- [squatsandsciencelabs/OpenBarbell-V3](https://github.com/squatsandsciencelabs/OpenBarbell-V3) — Primary firmware reference
- [makerdiary/nrf52840-mdk](https://github.com/makerdiary/nrf52840-mdk) — nRF52840 dev kit
- [tlancon/barbellcv](https://github.com/tlancon/barbellcv) — Camera VBT reference
- [web-bluetooth-samples](https://github.com/GoogleChromeLabs/web-bluetooth-samples) — Web Bluetooth API examples

## License

MIT
