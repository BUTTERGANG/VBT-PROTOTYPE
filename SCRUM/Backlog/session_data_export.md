---
title: "Session Data Export (CSV / PDF)"
status: done
priority: P1
project: VBT-PROTOTYPE
type: dev
agent_claimed: agent-03
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T12:00:00Z'
tags: []
due: null
estimate: small
---

# Session Data Export (CSV / PDF)

## Summary
Add an export button to SessionHistoryScreen so athletes and coaches can download session data as CSV or a formatted PDF for external review, record keeping, or sharing.

## Value Proposition
`docs/scrum-board.md` "Next Up" lists "Export session data (CSV / PDF)." The backend `sessions` route stores full session data; the frontend SessionHistoryScreen displays it. Export is the minimum feature needed for coaches who review athlete data outside the app (spreadsheets, printed reports).

## Context
- Frontend: `pwa/src/components/SessionHistoryScreen.tsx` — add export button
- Backend: `backend/src/routes/sessions.ts` — add `GET /api/sessions/:id/export?format=csv|pdf`
- CSV: one row per rep (timestamp, set_number, rep_number, load_kg, mean_velocity, peak_velocity, zone, e1rm_kg)
- PDF: formatted summary (session date, athlete, sets table, per-set bar path chart if recording exists)
- PDF generation: `pdfkit` or client-side via `jsPDF` (avoids server dependency)

## Acceptance Criteria
- [ ] "Export" button on SessionHistoryScreen (per session row)
- [ ] CSV download: one row per rep with all velocity and load fields
- [ ] PDF download: session header (date, athlete, total volume), set summary table, e1RM trend
- [ ] Export works for both completed and in-progress sessions
- [ ] File named `session_YYYY-MM-DD_athlete.csv` / `.pdf`

## Notes
P1: Small estimate — data already exists in backend; this is a download endpoint + client trigger. Use client-side CSV generation (no library needed) and jsPDF for PDF to avoid server-side dependencies.
