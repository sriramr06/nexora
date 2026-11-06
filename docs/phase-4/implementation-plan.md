# Implementation Plan

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 4 — Implementation Planning  
**Step:** 4.1 — Implementation Plan  
**Version:** 1.0  
**Status:** Approved

## 1. Objective

Turn the Phase 2 requirements and Phase 3 design into a sprint-by-sprint build plan with clear scope, completion criteria and risk controls.

## 2. Working Model

| Item | Decision |
|---|---|
| Start date | Friday 6 November 2026 |
| Availability | Full-time, 6–8 hours per day |
| Sprint length | 1 week (Sprint 1: 10 days) |
| Planned duration | 7 sprints, ending 27 December 2026 |
| Reserve | 28 December 2026 – 3 January 2027 (within the PID's 8-week ceiling) |
| Tracking | Sprint checklist per sprint in `docs/sprints/sprint-N.md` (stories and tasks as checkboxes); pull requests reference story IDs (e.g. "US-03") |
| Sprint start | Select stories and tasks for the sprint (15 minutes) |
| Sprint end | Review and retrospective notes in `docs/sprints/sprint-N.md` (15 minutes) |
| Branching | Feature branches → pull request → protected `main` (DEP-7) |

## 3. Key Principles

1. **Walking skeleton first:** Sprint 1 deploys a minimal end-to-end application (Vercel → proxy → Render → Atlas) with CI. Every following sprint deploys.
2. **Tests inside each sprint:** stories are not done until their acceptance criteria are covered by automated tests.
3. **Security foundations early:** tenancy pipeline, tenant-scoped repositories and the cross-tenant test harness are built before tenant features.
4. **Just-in-time learning:** core libraries are learned in Sprint 1; dnd-kit is learned at the start of Sprint 5.

## 4. Sprint Plan

### Sprint 1 — Foundations and Authentication (6 – 15 Nov)

**Goal:** a deployed skeleton with complete authentication.

- Learning: TanStack Query, Zustand, React Hook Form + Zod recap, shadcn/ui.
- Monorepo (`client`, `server`, `packages/shared`), TypeScript strict, ESLint, Prettier.
- GitHub Actions CI (lint, typecheck, test, build); protected `main`.
- Express skeleton: request ID, security headers, pino logging, error handler and format, `/health`.
- MongoDB connection, `withTransaction`, tenant-scoped repository base, index sync and seed script skeletons.
- Client skeleton: Vite, Tailwind, shadcn/ui, React Router, TanStack Query, axios client, Zustand store.
- **Walking skeleton deployed:** Vercel rewrite → Render → Atlas; deploy-after-CI pipeline.
- Authentication: register, verify email, login, refresh rotation with families and grace period, logout, forgot / reset / change password; rate limiting.
- Email service (console, fake, SMTP).
- Auth pages, interceptors (single-flight refresh), session restore, `RequireAuth`, `RequireVerified`.

**Stories:** US-01 – US-05.

### Sprint 2 — Organizations, Platform and Tenancy (16 – 22 Nov)

**Goal:** organizations can register, be approved and be accessed securely.

- Organization registration (incl. timezone), status lifecycle and history, resubmission.
- Application Owner: seed, organization list / details, approve, reject, suspend, reactivate, edit name.
- Tenancy pipeline: `loadTenant`, `requireMembership`, `requireActiveOrg`, `authorize`; status-exempt routes.
- Shared `can()` permission functions with unit tests.
- **Cross-tenant test harness.**
- Client: `OrgGate` and status pages, `/welcome`, organization switcher, `RequireOwner`, platform pages, approval / rejection emails.

**Stories:** US-06 – US-11, US-33 (harness).

### Sprint 3 — Members, Invitations and Profile (23 – 29 Nov)

**Goal:** teams can be built and managed.

- Invitations: single, bulk, Project Manager limits (R11), project pre-selection (R13), resend cooldown, revoke, lookup, register, accept.
- Members: list, change role, remove, leave; last-admin rule with `adminsVersion` (R1); R12.
- Profile: name; avatar upload with byte-level validation and Cloudinary transformation.

**Stories:** US-12 – US-16, US-31, US-32, US-34, US-35.

### Sprint 4 — Projects and Tasks Core (30 Nov – 6 Dec)

**Goal:** projects and tasks work end to end with history.

- Projects: create, update, manager, members, archive / restore, delete with cascade; accessible project list.
- Tasks: create, view, edit, delete, assignment rules (R4, Team Member self-assignment), optimistic concurrency (`version`).
- Activity recording service (transactional) and task history.
- My Tasks.

**Stories:** US-17 – US-24, US-27.

### Sprint 5 — Kanban and Workflow (7 – 13 Dec)

**Goal:** the board and review / blocker workflow.

- Learning: dnd-kit.
- Board endpoint and UI, optimistic drag with rollback, keyboard / menu alternative, filters, card details.
- Review rule (R14): submit, approve, request changes, reopen.
- Flags (R15, R16): Blocked / On hold, Blocked tasks dialog.
- Project summary (counts, overdue in organization timezone, blocked, % complete).
- Comments.

**Stories:** US-25, US-26, US-28, US-36 – US-38, US-19.

### Sprint 6 — Notifications, Rules and Polish (14 – 20 Dec)

**Goal:** collaboration signals and complete business rules.

- Notification service (central rules), list, unread count polling, mark read / all.
- Project activity feed (cursor pagination).
- Removal cascades: R5 (unassign open tasks) and R6 (unset manager) with notifications.
- UI states (loading, empty, error), responsive pass (360 px), accessibility pass.

**Stories:** US-15 (cascades), US-29, US-30.

### Sprint 7 — Hardening and Release (21 – 27 Dec)

**Goal:** a verified, documented, deployed MVP.

- End-to-end tests: J1, J3, J5 (Playwright).
- Complete the cross-tenant and permission suites; coverage targets (NFR-TEST-05).
- Security review against NFR-SEC and the authentication threat table.
- Performance check (board with 200 tasks).
- Documentation: README, architecture overview, ADRs, OpenAPI docs, demo script.
- Demo data seed; final production deployment; backup.

**Stories:** US-33 (complete), all remaining acceptance criteria.

## 5. Definition of Done (per story)

- Acceptance criteria covered by automated tests, all passing in CI.
- Authorization enforced on the backend (UI hiding is not sufficient).
- Validation and standard error responses in place.
- Activity entries and notifications produced where required.
- Works at 360 px and desktop widths.
- Merged to `main` through a pull request and deployed.

## 6. Scope Cut List

If the project is more than about 2 working days behind at the end of Sprint 4, items are cut **in this order**:

1. Application Owner edits organization name (FR-PLAT-07).
2. On hold flag (Blocked is kept).
3. Bulk invitations (single invitations are kept).
4. Project activity feed page (task history is kept).
5. End-to-end tests reduced to J1 only.

**Never cut:** tenant isolation and its tests, RBAC and permission tests, authentication security, the review rule, deployment.

## 7. Risks and Controls

| PID Risk | Control in This Plan |
|---|---|
| Scope creep | Approved scope documents; cut list decided in advance |
| Tenant isolation vulnerabilities | Tenancy pipeline and cross-tenant harness in Sprint 2, before tenant features |
| Overcomplicated authorization | Single shared `can()` implementation with matrix-based tests |
| Insufficient testing | Tests are part of the Definition of Done in every sprint |
| Deployment complexity | Walking skeleton deployed in Sprint 1; every sprint deploys |
| Inadequate stabilization time | Sprint 7 dedicated to hardening; reserve week after it |

**Next step:** Sprint 1.
