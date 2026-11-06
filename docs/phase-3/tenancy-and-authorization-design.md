# Tenancy and Authorization Design

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.2 — Tenancy and Authorization Design  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define how every request is tied to an organization, how tenant data isolation is enforced in MongoDB, and how permissions are checked.

## 2. Decisions

| ID | Decision |
|---|---|
| TEN-1 | **Shared database, shared collections**; every tenant-owned document carries `organizationId`. |
| TEN-2 | The organization is identified by the **URL path**: `/api/v1/orgs/:orgId/...`. |
| TEN-3 | The JWT carries **identity only** (`userId`). Organization role is read from `memberships` on every request. |
| TEN-4 | Role and permission information is **never accepted from the client**. |
| TEN-5 | Tenant scoping is applied by a **central tenant-scoped repository layer**, not by individual handlers. |
| TEN-6 | Cross-tenant and inaccessible-project requests return **404**; permitted visibility without permission returns **403**. |
| TEN-7 | Permission rules are implemented once as pure functions in `packages/shared` and used by both server and client. |

## 3. Why MongoDB Isolation Is Enforced in the Application

MongoDB has no row-level security equivalent to PostgreSQL's. The database therefore cannot stop a query from reading another tenant's documents; the application must. Isolation is enforced by:

1. a single entry point for tenant data access (tenant-scoped repositories);
2. queries without an organization scope failing instead of returning unscoped data (NFR-ISO-03);
3. validating that every referenced document (assignee, project member, project) belongs to the same organization (NFR-ISO-05);
4. compound indexes beginning with `organizationId` (NFR-PERF-04);
5. an automated cross-tenant test suite covering every tenant endpoint (NFR-ISO-07).

## 4. Trust Model

| Input | Source | Trusted? |
|---|---|---|
| `userId` | Signed JWT `sub` | Yes, after signature and expiry verification |
| `orgId` | URL path | Only after membership verification |
| Role | `memberships` collection | Yes — server-side lookup only |
| Project access | `projects.managerId` / `memberIds` | Yes — server-side lookup only |
| Any role, user ID or organization ID in the request body | Client | Never used for authorization |

## 5. Request Pipeline

```
authenticate       verify JWT; load user; reject if issued before passwordChangedAt      → 401
loadTenant         load organization by :orgId                                           → 404
requireMembership  find membership (organizationId, userId)                              → 404
requireActiveOrg   organization status = active (except status-exempt routes)            → 403 ORG_NOT_ACTIVE
authorize          can(actor, action, context): role, project access, resource rules     → 403 / 404
validate           Zod schemas for params, query, body                                   → 400
handler            tenant-scoped repository calls inside transactions where needed
```

The request context carries `{ user, organization, membership }` for all later layers.

**Platform routes** (`/api/v1/platform/...`) use `authenticate` followed by `requireOwner` (`users.platformRole = "owner"`). The Application Owner has no memberships and therefore cannot pass `requireMembership` on tenant routes.

## 6. Tenant-Scoped Repositories

- Repositories for tenant-owned collections are created with the request's `organizationId` and add it to **every** query, update and delete.
- Creating a document sets `organizationId` from the context, never from the request body.
- Calling a tenant-owned repository without an organization context throws an error.
- Loading a resource by ID uses `{ _id, organizationId }`, so a valid ID from another tenant is simply "not found".

## 7. Authorization Functions

`packages/shared` exports pure functions implementing the Roles document (Step 2.2), for example:

```ts
can(actor, "task.changeStatus", { task, project, toStatus })
can(actor, "invitation.create", { role, projectIds, managedProjectIds })
```

- `actor` contains the membership role and user ID.
- `context` contains the facts loaded by the server (project manager, members, task assignee, creator, flag).
- The server calls these in `authorize`; the client uses them to hide or disable actions.
- Each matrix entry and rule (R1–R16) has unit tests against these functions, plus integration tests through the API.

## 8. Concurrency-Sensitive Rules

| Rule | Mechanism |
|---|---|
| Last Tenant Admin (R1) | Transaction increments `organizations.adminsVersion` so concurrent admin changes conflict and are re-checked |
| Task updates | Optimistic concurrency with `tasks.version` (409 `VERSION_CONFLICT`) |
| One pending invitation per email | Partial unique index on `invitations` |
| Unique project name per organization | Case-insensitive unique index |

## 9. Verification

- Cross-tenant suite: for each tenant endpoint, a user of Organization A requests Organization B's resources by ID and lists — expected 404 / no leakage.
- Permission suite: each role × action combination from the matrix.
- Escalation tests: e.g. Project Manager inviting a Tenant Admin, Team Member approving a task, client-supplied role or `organizationId` in bodies ignored.

**Next step:** Step 3.3 — Data Model.
