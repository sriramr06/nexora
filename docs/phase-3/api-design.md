# API Design

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.5 — API Design  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the REST API conventions, response and error formats, pagination, concurrency control and the complete endpoint list for the MVP.

## 2. Conventions

| ID | Convention |
|---|---|
| API-1 | Base path `/api/v1`. JSON request and response bodies; camelCase field names. |
| API-2 | Plural resource nouns; HTTP methods carry meaning: `GET` read, `POST` create or action, `PATCH` partial update, `PUT` replace a sub-resource, `DELETE` remove. |
| API-3 | Timestamps are ISO 8601 strings in UTC. Due dates are calendar dates (`YYYY-MM-DD`). IDs are ObjectId strings. |
| API-4 | **Tenant routes** always include the organization: `/orgs/:orgId/...`. |
| API-5 | **Shallow nesting:** resources are nested under their parent only for listing and creation; individual resources are addressed directly under the organization (e.g. `/orgs/:orgId/tasks/:taskId`). |
| API-6 | **Workflow actions** with their own permission rules have dedicated endpoints (status, request changes, assignee, flag). `PATCH` is used only for plain field edits. |
| API-7 | Related users are returned as summaries `{ id, name, avatarUrl }`. |
| API-8 | Secret tokens (verification, reset, invitation) are sent in the request **body**, never in API URLs, so they do not appear in server or proxy logs. |
| API-9 | The API is documented with OpenAPI, generated from the shared Zod schemas. |

## 3. Response Format

```jsonc
// Single resource
{ "data": { ... } }

// List
{ "data": [ ... ], "pagination": { ... } }

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "details": [ { "field": "title", "message": "Title is required" } ],
    "requestId": "req_8f2a..."
  }
}
```

`code` is machine-readable for the frontend; `message` is human-readable; `requestId` matches the server logs.

## 4. Status Codes

| Code | Usage |
|---|---|
| 200 / 201 / 204 | Success / created / success without body |
| 400 | Validation failed |
| 401 | Not authenticated or token expired |
| 403 | Resource visible, action not permitted; organization not active |
| 404 | Resource does not exist **or belongs to another tenant / inaccessible project** |
| 409 | Conflict with current state (duplicate, last admin, version mismatch, invalid transition) |
| 429 | Rate limit or cooldown exceeded |
| 500 | Unexpected error (generic message, no internals) |

### 4.1 Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body or query is invalid |
| `UNAUTHENTICATED` | 401 | Missing or invalid credentials / token |
| `TOKEN_EXPIRED` | 401 | Access token expired — client should refresh |
| `EMAIL_NOT_VERIFIED` | 403 | Action requires a verified email |
| `FORBIDDEN` | 403 | Role or resource rule denies the action |
| `ORG_NOT_ACTIVE` | 403 | Organization is pending, rejected or suspended |
| `NOT_FOUND` | 404 | Not found or not accessible |
| `DUPLICATE` | 409 | Unique value already exists (email, project name, pending invitation) |
| `LAST_ADMIN` | 409 | Change would leave the organization without a Tenant Admin |
| `VERSION_CONFLICT` | 409 | Task changed since the client loaded it |
| `INVALID_TRANSITION` | 409 | Status or flag change not allowed from the current state |
| `TASK_BLOCKED` | 409 | Task is Blocked; status change requires a manager to unblock |
| `INVITATION_INVALID` | 400 | Invitation token invalid, expired, revoked or used |
| `INVITATION_EMAIL_MISMATCH` | 403 | Logged-in email differs from the invited email |
| `RESEND_COOLDOWN` | 429 | Invitation resent less than 5 minutes ago |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## 5. Pagination

| Style | Used for | Request | Response `pagination` |
|---|---|---|---|
| **Page-based** | Tables: platform organizations, members, invitations, projects, My Tasks | `?page=1&limit=20` | `{ page, limit, total, totalPages }` |
| **Cursor-based** | Feeds: project / task activity, notifications, comments | `?cursor=<opaque>&limit=20` | `{ nextCursor, hasMore }` |

- Default `limit` 20, maximum 100 (NFR-PERF-03).
- Cursors prevent duplicated or skipped items when new entries are added while paging.
- **Board exception:** the board returns all project tasks in one response, capped at 500, with `truncated: true` if the cap is exceeded.

## 6. Concurrency Control (Tasks)

- Every task has a `version` number, returned in all task responses.
- Task-changing requests (`PATCH`, status, request changes, assignee, flag) must include the `version` the client last saw.
- If it does not match the stored version, the server responds `409 VERSION_CONFLICT` and the client reloads the task.
- Successful changes increment `version`.

## 7. Middleware Chain (Tenant Routes)

```
authenticate      → verify JWT; load user; reject tokens older than passwordChangedAt
loadTenant        → load organization by :orgId (404 if missing)
requireMembership → membership for (orgId, userId) or 404
requireActiveOrg  → status must be active, else 403 ORG_NOT_ACTIVE (except status-exempt routes)
authorize         → role permission (403) and resource access (project membership, else 404)
validate          → Zod schema for params, query and body (400)
handler           → data access through the tenant-scoped repository
```

**Status-exempt routes** (usable while the organization is not active): `GET /orgs/:orgId`, `PATCH /orgs/:orgId` (Rejected only), `POST /orgs/:orgId/resubmit`.

## 8. Endpoints

**Access legend:** Public · User (logged in) · Verified (logged in, email verified) · Owner (Application Owner) · Tenant (organization member; specific permissions per the Roles document, Section 5).

### 8.1 Auth — `/api/v1/auth`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| POST | `/auth/register` | Public | Register; send verification email | FR-AUTH-01 – 04 |
| POST | `/auth/verify-email` | Public | Verify email with `{ token }` | FR-AUTH-04 |
| POST | `/auth/resend-verification` | User | Send a new verification email | FR-AUTH-06 |
| POST | `/auth/login` | Public | Log in; returns access token, sets refresh cookie | FR-AUTH-07 |
| POST | `/auth/refresh` | Cookie | Rotate refresh token; returns new access token | FR-AUTH-08 |
| POST | `/auth/logout` | Cookie | Revoke session family; clear cookie | FR-AUTH-09 |
| POST | `/auth/forgot-password` | Public | Always same response; email reset link if account exists | FR-AUTH-10 |
| POST | `/auth/reset-password` | Public | Reset with `{ token, password }`; revoke all sessions | FR-AUTH-11, 12 |
| POST | `/auth/change-password` | User | Change with current password; revoke other sessions | FR-AUTH-13 |

### 8.2 Current User — `/api/v1/me`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/me` | User | Current user profile | — |
| PATCH | `/me` | User | Update name | FR-PROF-01 |
| POST | `/me/avatar` | User | Upload avatar (multipart; JPEG / PNG / WebP ≤ 2 MB) | FR-PROF-02, 03 |
| DELETE | `/me/avatar` | User | Remove avatar | FR-PROF-03 |
| GET | `/me/organizations` | User | Memberships with organization name, status and role | FR-ORG-06, 07 |

### 8.3 Invitations (Public Side) — `/api/v1/invitations`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| POST | `/invitations/lookup` | Public | Validate `{ token }`; return organization name, invited email, role, status | FR-INV-08 |
| POST | `/invitations/register` | Public | Register through invitation `{ token, name, password }`; join and log in | FR-INV-06 |
| POST | `/invitations/accept` | User | Accept `{ token }` as an existing user (email must match) | FR-INV-07, 08 |

### 8.4 Platform — `/api/v1/platform`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/platform/organizations` | Owner | List; filter `status`, search `q`; page-based | FR-PLAT-02 |
| GET | `/platform/organizations/:id` | Owner | Metadata, status history, member count, admin contacts | FR-PLAT-03 |
| PATCH | `/platform/organizations/:id` | Owner | Edit name | FR-PLAT-07 |
| POST | `/platform/organizations/:id/approve` | Owner | Approve | FR-PLAT-04 |
| POST | `/platform/organizations/:id/reject` | Owner | Reject `{ reason }` | FR-PLAT-05 |
| POST | `/platform/organizations/:id/suspend` | Owner | Suspend `{ reason }` | FR-PLAT-06 |
| POST | `/platform/organizations/:id/reactivate` | Owner | Reactivate | FR-PLAT-06 |

### 8.5 Organizations — `/api/v1/orgs`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| POST | `/orgs` | Verified | Register organization (Pending Approval) | FR-ORG-01, 02 |
| GET | `/orgs/:orgId` | Tenant | Organization details and status (status-exempt) | FR-ORG-03 |
| PATCH | `/orgs/:orgId` | Tenant Admin | Update details (Active, or Rejected before resubmission) | FR-ORG-04, 05 |
| POST | `/orgs/:orgId/resubmit` | Tenant Admin | Resubmit a Rejected organization | FR-ORG-04 |

### 8.6 Members — `/api/v1/orgs/:orgId/members`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/orgs/:orgId/members` | Tenant | List members; page-based | FR-MEM-01 |
| PATCH | `/orgs/:orgId/members/:userId` | Tenant Admin | Change role `{ role }` | FR-MEM-02 |
| DELETE | `/orgs/:orgId/members/:userId` | Tenant Admin | Remove member | FR-MEM-03 |
| POST | `/orgs/:orgId/leave` | Tenant | Leave organization | FR-MEM-04 |

### 8.7 Invitations (Tenant Side) — `/api/v1/orgs/:orgId/invitations`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/orgs/:orgId/invitations` | Admin (all) / PM (own) | List; filter `status`; page-based | FR-INV-05, 13 |
| POST | `/orgs/:orgId/invitations` | Admin / PM | Invite `{ email, role, projectIds }` | FR-INV-01, 10, 11 |
| POST | `/orgs/:orgId/invitations/bulk` | Admin / PM | Invite `{ emails[≤20], role, projectIds }`; per-address results | FR-INV-12 |
| POST | `/orgs/:orgId/invitations/:invitationId/resend` | Admin / PM (own) | Resend (5-minute cooldown) | FR-INV-05 |
| POST | `/orgs/:orgId/invitations/:invitationId/revoke` | Admin / PM (own) | Revoke | FR-INV-05 |

### 8.8 Projects — `/api/v1/orgs/:orgId/projects`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/orgs/:orgId/projects` | Tenant | Accessible projects; filter `status`; page-based | FR-PROJ-05 |
| POST | `/orgs/:orgId/projects` | Admin / PM | Create | FR-PROJ-01, 02 |
| GET | `/orgs/:orgId/projects/:projectId` | Project access | Details with manager and members | — |
| PATCH | `/orgs/:orgId/projects/:projectId` | Admin / manager | Update name, description | FR-PROJ-03 |
| PUT | `/orgs/:orgId/projects/:projectId/manager` | Admin | Set manager `{ userId }` | FR-PROJ-02 |
| POST | `/orgs/:orgId/projects/:projectId/members` | Admin / manager | Add members `{ userIds[] }` | FR-PROJ-04 |
| DELETE | `/orgs/:orgId/projects/:projectId/members/:userId` | Admin / manager | Remove member (R5) | FR-PROJ-04 |
| POST | `/orgs/:orgId/projects/:projectId/archive` | Admin / manager | Archive | FR-PROJ-06 |
| POST | `/orgs/:orgId/projects/:projectId/restore` | Admin / manager | Restore | FR-PROJ-06 |
| DELETE | `/orgs/:orgId/projects/:projectId` | Admin | Delete with cascade | FR-PROJ-07 |
| GET | `/orgs/:orgId/projects/:projectId/summary` | Project access | Counts per status, overdue, blocked, % complete | FR-PROJ-08 |
| GET | `/orgs/:orgId/projects/:projectId/activity` | Project access | Project feed; cursor-based | FR-ACT-04 |
| GET | `/orgs/:orgId/projects/:projectId/board` | Project access | All tasks grouped by status; filters `assigneeId`, `priority`, `flag` | FR-BOARD-01 – 08 |
| GET | `/orgs/:orgId/projects/:projectId/blocked-tasks` | Project access | Blocked tasks with reason, flagger and time | FR-BOARD-09 |

### 8.9 Tasks — `/api/v1/orgs/:orgId/...`

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| POST | `/orgs/:orgId/projects/:projectId/tasks` | Project access | Create task | FR-TASK-01, 02, 06 |
| GET | `/orgs/:orgId/tasks/:taskId` | Project access | Task details | — |
| PATCH | `/orgs/:orgId/tasks/:taskId` | Per matrix | Edit title, description, priority, due date `{ ..., version }` | FR-TASK-08 |
| DELETE | `/orgs/:orgId/tasks/:taskId` | Admin / manager | Delete | FR-TASK-09 |
| POST | `/orgs/:orgId/tasks/:taskId/status` | Per R14 | Change status `{ status, version }` | FR-TASK-03, 12, 13 |
| POST | `/orgs/:orgId/tasks/:taskId/request-changes` | Admin / manager | In Review → In Progress `{ reason, version }` | FR-TASK-13 |
| PUT | `/orgs/:orgId/tasks/:taskId/assignee` | Per matrix | Assign / reassign / unassign `{ assigneeId \| null, version }` | FR-TASK-05 – 07 |
| PUT | `/orgs/:orgId/tasks/:taskId/flag` | Per R16 | Set flag `{ type, reason, version }` | FR-TASK-14, 15 |
| DELETE | `/orgs/:orgId/tasks/:taskId/flag` | Per R16 | Clear flag `{ version }` | FR-TASK-15 |
| GET | `/orgs/:orgId/tasks/:taskId/activity` | Project access | Task history; cursor-based | FR-ACT-03 |
| GET | `/orgs/:orgId/my-tasks` | Tenant | Assigned tasks; filter `status`; sort `dueDate`; page-based | FR-TASK-11 |

### 8.10 Comments

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/orgs/:orgId/tasks/:taskId/comments` | Project access | Oldest first; cursor-based | FR-COM-02 |
| POST | `/orgs/:orgId/tasks/:taskId/comments` | Project access | Add comment | FR-COM-01 |
| PATCH | `/orgs/:orgId/comments/:commentId` | Author | Edit | FR-COM-03 |
| DELETE | `/orgs/:orgId/comments/:commentId` | Author / manager / Admin | Delete | FR-COM-04 |

### 8.11 Notifications

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/orgs/:orgId/notifications` | Tenant | Own notifications, newest first; cursor-based | FR-NOT-04, 07 |
| GET | `/orgs/:orgId/notifications/unread-count` | Tenant | Unread count (polled) | FR-NOT-03, 06 |
| POST | `/orgs/:orgId/notifications/:notificationId/read` | Tenant (recipient) | Mark as read | FR-NOT-05 |
| POST | `/orgs/:orgId/notifications/read-all` | Tenant | Mark all as read | FR-NOT-05 |

### 8.12 System

| Method | Path | Access | Description | Refs |
|---|---|---|---|---|
| GET | `/health` | Public | Health check (API and database) | NFR-REL-04 |

**Total:** 71 endpoints.

## 9. Rate Limits

| Scope | Limit |
|---|---|
| `/auth/login` | 10 attempts per 15 minutes per IP and email |
| `/auth/register`, `/auth/forgot-password`, `/auth/resend-verification` | 5 per hour per IP |
| `/invitations/lookup`, `/invitations/register`, `/invitations/accept` | 20 per 15 minutes per IP |
| Invitation resend | 1 per 5 minutes per invitation |
| General API | 300 per 15 minutes per user |

**Next step:** Step 3.6 — Frontend Architecture.
