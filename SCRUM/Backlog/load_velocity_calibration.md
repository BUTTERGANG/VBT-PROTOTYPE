---
title: "Per-Athlete LV Profile Calibration"
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

# Per-Athlete LV Profile Calibration

## Summary
Implement a load-velocity profile calibration flow where an athlete lifts at known percentages of their 1RM to build a personalized LV curve, replacing the generic population defaults currently used for e1RM estimation.

## Value Proposition
`docs/scrum-board.md` "Next Up" explicitly lists "Load-velocity profile calibration per athlete." `WorkoutScreen` renders a load-velocity profile and `pwa/src/utils/oneRMCalculator.ts` estimates 1RM — but without calibration the slope and intercept are generic, making the estimates unreliable for any individual athlete.

## Context
- Existing: `pwa/src/utils/oneRMCalculator.ts` — e1RM calculation (generic slope/intercept)
- Existing: `pwa/src/components/WorkoutScreen.tsx` — renders load-velocity profile chart
- Backend: `backend/src/routes/athletes.ts` — extend with `/api/athletes/:id/calibration` endpoint
- Calibration protocol: 2–4 reps at 3 known loads (e.g. 60%, 70%, 80% 1RM); record mean velocity per load; fit linear regression to get personal slope/intercept
- Store: athlete's `mv0` (theoretical max velocity at 0 load) and `slope` in DB

## Acceptance Criteria
- [ ] Calibration flow UI: multi-step wizard (select loads → lift → review → save) accessible from AthleteProfilesScreen
- [ ] Linear regression fits velocity vs. %1RM data points to derive personal slope and intercept
- [ ] Calibration stored per athlete in backend via `POST /api/athletes/:id/calibration`
- [ ] `oneRMCalculator.ts` uses calibrated values when available; falls back to population defaults
- [ ] WorkoutScreen shows "Calibrated" badge on the LV profile when personal data is active

## Notes
P1: This is the core accuracy improvement for the product's primary value prop. Medium estimate — the math is straightforward (linear regression on 3 points); main work is the calibration wizard UI and backend endpoint.
