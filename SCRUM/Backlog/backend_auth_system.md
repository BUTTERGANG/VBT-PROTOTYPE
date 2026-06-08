---
title: "Backend JWT Auth System"
status: sprint
priority: P0
project: VBT-PROTOTYPE
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: large
---

# Backend JWT Auth System

## Summary
Add JWT authentication to the VBT backend so all API routes are protected and athlete data is scoped to the authenticated user — currently every route is completely open.

## Value Proposition
`backend/src/index.ts` mounts 5 routes (sessions, athletes, programs, analytics, sync) with zero authentication middleware. Any unauthenticated caller can read or write any athlete's session data. This is a blocking issue for production use and multi-athlete coach scenarios — no other Sprint 8 features (coach mode, athlete profiles, program sync) are safe to build on top of an open API.

## Context
- Backend entry point: `backend/src/index.ts` — no auth.ts import, no middleware
- Routes: `backend/src/routes/` — sessions, athletes, programs, analytics, sync (all unprotected)
- Database: `backend/src/db/schema.sql` — add `users` table
- Pattern: mirror civic-duty auth (`jsonwebtoken` + `bcryptjs`) — same Node.js stack
- New env var: `JWT_SECRET` in `.env.example`

## Acceptance Criteria
- [ ] `POST /api/auth/register` — create user (email + password hash via bcryptjs)
- [ ] `POST /api/auth/login` — return signed JWT (24h expiry)
- [ ] `GET /api/auth/me` — return current user from Bearer token
- [ ] JWT middleware guards all existing routes; requests without valid token get 401
- [ ] Athlete sessions and programs scoped to `user_id` from JWT payload
- [ ] `JWT_SECRET` added to `.env.example` with documentation
- [ ] CI pipeline (GitHub Actions) updated to test auth flow

## Notes
P0: Blocking. No other backend-dependent Sprint 8 features should merge until auth is in place. Large estimate — schema migration + middleware + 3 auth endpoints + route scoping across 5 existing routers.
