---
title: "BLE Device Pairing UI"
status: sprint
priority: P1
project: VBT-PROTOTYPE
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: medium
---

# BLE Device Pairing UI

## Summary
Build the device scan and pairing flow in the PWA so users can discover, pair, and reconnect to a BLE VBT device — the missing UI layer over the existing BLEManager service.

## Value Proposition
`pwa/src/services/ble/BLEManager.ts` implements the Web Bluetooth API layer, but `docs/scrum-board.md` explicitly lists "BLE device pairing flow in PWA" as the next backlog item. Without a pairing UI, the entire BLE pipeline is developer-only — users have no way to connect a physical device through the app.

## Context
- BLE service: `pwa/src/services/ble/BLEManager.ts`
- Settings screen exists: `pwa/src/components/SettingsScreen.tsx` — add a "Connected Device" section
- LiveLiftScreen: `pwa/src/components/LiveLiftScreen.tsx` — add auto-reconnect logic
- Persistence: `pwa/src/services/storage/LocalCache.ts` (IndexedDB/Dexie) — store paired device ID
- Web Bluetooth requires HTTPS or localhost; Replit HTTPS deployment satisfies this

## Acceptance Criteria
- [ ] "Connected Device" section in SettingsScreen with "Scan for devices" button
- [ ] Device scan opens Web Bluetooth picker; selected device stored in IndexedDB via LocalCache
- [ ] LiveLiftScreen auto-connects to last-paired device on component mount (no manual re-pair each session)
- [ ] Connection status indicator (connected / connecting / disconnected) visible in LiveLiftScreen header
- [ ] Clear error state with actionable message when Bluetooth is off, denied, or device out of range

## Notes
P1: Core hardware integration path. Medium estimate — BLEManager exists; this is purely UI/UX + persistence wiring. Must test on physical device with HTTPS (Replit deploy).
