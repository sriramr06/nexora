# Sprint 7 — Hardening and Release

**Dates:** 11 – 16 November 2026 (plan v1.1)  
**Goal:** a verified, documented, deployed MVP.

## Decisions

1. End-to-end tests run in CI on every pull request; production deploys wait for them.
2. API docs are generated from the shared Zod schemas and served with Swagger UI at `/api/docs`.
3. Demo seed: one command, Acme Corp with five people and three projects; demo logins live in the README only.
4. README written for recruiters: pitch, screenshots, architecture, decisions, how to run.

## Delivered

- [x] `npm run db:seed:demo`: 23 tasks in every state (review, changes requested, blocked, on hold, overdue, comments), created through the real API in-process, so history and notifications are genuine; safe to re-run
- [x] Playwright journeys J1 (onboarding + Owner approval), J3 (review workflow from a notification), J5 (invitation); test stack with an in-memory replica set, captured emails and a reset endpoint outside the app
- [x] CI job `End-to-end (Playwright)`; deploy needs it
- [x] OpenAPI 3.1 for all 74 operations + Swagger UI; tests check it matches the validators
- [x] Security and performance review ([phase-5](../phase-5/security-and-performance-review.md)): NFR-SEC-01 – 12 checked against the code; 200-task board in 17 ms (API) and 1.48 s (render)
- [x] Architecture decisions ([phase-5](../phase-5/architecture-decisions.md))
- [x] README with screenshots
- [x] Fix: long Blocked / On hold reasons stretched cards over the next column (found while taking screenshots)

## Not done (follow-ups)

- Move `shadcn` to devDependencies (npm workspace install bug).
- Shared rate-limit store before scaling the API out.

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next time:**
