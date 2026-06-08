---
title: "Program Builder UI"
status: sprint
priority: P2
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

# Program Builder UI

## Summary
Build the Program Builder screen in the PWA so athletes can create and manage training programs with weekly structure, exercise prescriptions, and velocity zone targets — backed by the existing programs API route.

## Value Proposition
`backend/src/routes/programs.ts` exists and is wired in `index.ts` but the PWA has no program builder UI — athletes have no way to create or load a structured training program. Without programs, WorkoutScreen operates in a free-form mode with no prescription, and the autoregulation service has no target to compare against.

## Context
- Backend: `backend/src/routes/programs.ts` — verify CRUD endpoints exist; add if missing
- Database: `backend/src/db/schema.sql` — confirm `programs` table structure (name, weeks, sessions_per_week, exercises JSONB)
- New PWA screen: `pwa/src/components/ProgramBuilderScreen.tsx` — add to router/navigation
- WorkoutScreen: `pwa/src/components/WorkoutScreen.tsx` — load active program as daily prescription
- Autoregulate: `autoregulate/main.py` — pass target velocity zone from program per exercise

## Acceptance Criteria
- [ ] Program Builder screen accessible from nav; create/edit/delete programs
- [ ] Program structure: name, weeks, sessions per week, exercises per session (with sets, reps, target load %, target velocity zone)
- [ ] Programs stored in backend via existing programs route and synced via sync route
- [ ] WorkoutScreen shows today's prescribed exercises from the active program
- [ ] Active program can be set from AthleteProfilesScreen (one active program at a time)

## Notes
P2: Medium estimate — backend route likely needs CRUD fleshing out; main work is the multi-step builder UI. Autoregulation integration can be scoped to passing target zone only (no full program-aware fatigue model yet).
