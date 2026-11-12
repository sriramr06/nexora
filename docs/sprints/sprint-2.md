# Sprint 2 — Organizations, Platform and Tenancy

**Dates:** 13 – 16 November 2026 (plan v1.1, started 12 Nov)  
**Goal:** organizations can register, be approved and be accessed securely.

## Decisions (12 Nov 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Open registrations per user | One Pending / Rejected organization per creator at a time (FR-ORG-09), enforced by a partial unique index |
| Q2 | Emails on suspend / reactivate | Email every Tenant Admin (FR-ORG-10) |
| Q3 | Last used organization | Browser `localStorage`, per user; falls back to the first membership |

## Backend

- [x] `organizations` and `memberships` models with indexes (data model §4.2, §4.3)
- [x] Tenancy pipeline: `authenticate → loadTenant → membership → requireActiveOrg → authorize` (404 for outsiders, 403 `ORG_NOT_ACTIVE`)
- [x] `tenantScoped` guard (unscoped tenant queries throw) + `forTenant()` repository (NFR-ISO-03)
- [x] Shared `can()` — Roles §5.1 with matrix and escalation tests
- [x] `POST /orgs`, `GET/PATCH /orgs/:orgId`, `POST /orgs/:orgId/resubmit`, `GET /me`, `GET /me/organizations`
- [x] Platform: list / filter / search, details, rename, approve / reject / suspend / reactivate (atomic status transitions + history)
- [x] Lifecycle emails (approve, reject, suspend, reactivate)
- [x] Application Owner seed (`npm run db:seed` with `OWNER_EMAIL`, `OWNER_PASSWORD`)
- [x] **Cross-tenant harness** (`server/src/test/tenant-endpoints.ts`) — extend it with every new tenant endpoint

## Client

- [x] Organization form (registration, settings, fix-and-resubmit) with timezone pre-filled
- [x] `OrgGate` + status pages (awaiting approval, rejected with reason, suspended)
- [x] Organization switcher; `/` → last used organization / `/welcome` / platform
- [x] `RequireOwner`, `RequireTenantUser`; platform list and detail pages with reason dialogs
- [x] Browser-checked end to end (light, 360 px)

## Stories

- [x] US-06 Register my organization
- [x] US-07 Resubmit a rejected organization
- [x] US-08 Switch between organizations
- [x] US-09 Review pending organizations
- [x] US-10 Approve or reject an organization
- [x] US-11 Suspend or reactivate an organization
- [x] US-33 Cross-tenant harness (completed as tenant endpoints are added)

## Deployment Note

After merging, seed the production Application Owner once (from a machine with the production `MONGODB_URI`):

```
OWNER_EMAIL=... OWNER_PASSWORD=... npm run db:seed
```

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
