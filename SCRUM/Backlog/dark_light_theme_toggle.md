---
title: "Dark/Light Theme Toggle"
status: backlog
priority: P3
project: VBT-PROTOTYPE
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: small
---

# Dark/Light Theme Toggle

## Summary
Add a dark/light theme toggle to SettingsScreen so athletes can choose their preferred display mode, persisted across sessions.

## Value Proposition
`docs/scrum-board.md` "Next Up" lists "Dark/light theme toggle." The app is used in gym environments under variable lighting — dark mode reduces eye strain on bright screens. `SettingsScreen.tsx` already exists as the natural home for this preference.

## Context
- Settings screen: `pwa/src/components/SettingsScreen.tsx`
- Tailwind CSS v4 with Vite — dark mode via `class` strategy in `tailwind.config` or `@media (prefers-color-scheme: dark)`
- Persistence: `pwa/src/services/storage/LocalCache.ts` (IndexedDB/Dexie) — store `theme` preference
- App root: `pwa/src/` — toggle `dark` class on `<html>` element
- Default: respect `prefers-color-scheme` media query on first load

## Acceptance Criteria
- [ ] Toggle in SettingsScreen (light / dark / system options)
- [ ] Preference persisted in IndexedDB via LocalCache; restored on app load
- [ ] Theme applies immediately without page reload
- [ ] "System" option respects `prefers-color-scheme` media query
- [ ] All 16 screen components render correctly in both modes (spot-check: LiveLiftScreen, WorkoutScreen, AnalyticsDashboard)

## Notes
P3: Small estimate — Tailwind dark mode class strategy + one LocalCache write + SettingsScreen toggle. The main work is ensuring existing components don't have hardcoded light-mode colors.
