---
title: "Coach-Athlete Backend Relationship"
status: backlog
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

# Coach-Athlete Backend Relationship

## Summary
Implement the coach-athlete data model and backend API so CoachModeScreen can render a real athlete roster with session data — currently the screen is a UI stub with no backend wiring.

## Value Proposition
`pwa/src/components/CoachModeScreen.tsx` exists but `backend/src/db/schema.sql` has no coach-athlete relationship table and the backend has no routes for it. Without this, coach mode is permanently a demo. This is the minimal backend to make the coach workflow functional.

## Context
- Frontend stub: `pwa/src/components/CoachModeScreen.tsx`
- Backend routes dir: `backend/src/routes/` — new `coach.ts` route file
- Schema: new `coach_athletes` join table — `coach_id` (FK → users), `athlete_id` (FK → users), `invited_at`, `accepted_at`
- Coach reads sessions and analytics for their athletes; cannot write on behalf of athletes
- Depends on: `backend_auth_system` (P0) — must be completed first

## Acceptance Criteria
- [ ] `coach_athletes` join table in schema with invite/accept lifecycle columns
- [ ] `POST /api/coach/invite` — coach invites an athlete by email; creates pending relationship
- [ ] `PATCH /api/coach/invite/:id/accept` — athlete accepts invite
- [ ] `GET /api/coach/athletes` — coach lists their accepted athletes with last session summary
- [ ] `GET /api/coach/athletes/:id/sessions` — coach reads an athlete's session history (read-only)
- [ ] CoachModeScreen renders real athlete list and links to per-athlete session history

## Notes
P2: Depends on `backend_auth_system` (P0). Medium estimate — schema + 4 endpoints + screen wiring. Scope to read-only coach access; athlete data write access is a future item.
