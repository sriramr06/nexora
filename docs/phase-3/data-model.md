# Data Model

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.3 — Data Model  
**Version:** 1.0  
**Status:** Draft — all collections locked

## 1. Objective

Define the MongoDB collections, fields, constraints and indexes for Nexora, traceable to the Phase 2 requirements.

## 2. Structural Decisions (Approved)

| ID | Decision |
|---|---|
| DM-1 | Memberships are a separate collection, unique on `(organizationId, userId)`. |
| DM-2 | Project members are embedded in the project as `memberIds[]`. |
| DM-3 | Comments, activities and notifications are separate collections. |
| DM-4 | Activity entries store a snapshot of relevant values (e.g. task title) and `changes { from, to }`. |
| DM-5 | Users are referenced by ID elsewhere, not duplicated. |
| DM-6 | Tokens are stored only as hashes; expiring tokens use TTL indexes. |
| DM-7 | Notifications are deleted automatically after 90 days (TTL index). |
| DM-8 | Deletes are hard deletes, performed in transactions. Organizations are never deleted, only suspended. |

## 3. Collection Overview

| Group | Collections |
|---|---|
| Global | `users`, `organizations`, `refreshTokens`, `userTokens` |
| Tenant-owned (carry `organizationId`) | `memberships`, `invitations`, `projects`, `tasks`, `comments`, `activities`, `notifications` |

## 4. Collections

### 4.1 `users` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `name` | String | Yes | Single name field; trimmed; 2–80 characters |
| `email` | String | Yes | Unique; stored lowercase and trimmed |
| `passwordHash` | String | Yes | Never returned by the API |
| `emailVerified` | Boolean | Yes | Default `false`; set `true` on verification or registration through an invitation |
| `avatar` | Object | No | `{ url: String, publicId: String }` — `publicId` is the Cloudinary ID used to delete replaced images |
| `platformRole` | Enum | No | `"owner"` or absent; set only by the seed script |
| `passwordChangedAt` | Date | No | Tokens issued before this time are rejected |
| `lastLoginAt` | Date | No | Updated on successful login; shown on the Application Owner dashboard |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Indexes:** unique `{ email: 1 }`.

### 4.2 `organizations` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated; used as `:orgId` in URLs |
| `name` | String | Yes | Trimmed; 2–100 characters; **not unique** across Nexora |
| `type` | Enum | Yes | `product` / `service` / `both` |
| `size` | Enum | Yes | `1-10` / `11-50` / `51-200` / `201-500` / `500+` |
| `industry` | Enum | Yes | `it_services` / `software_product` / `fintech` / `healthtech` / `edtech` / `ecommerce_retail` / `media_entertainment` / `manufacturing` / `consulting` / `other` |
| `country` | String | Yes | ISO 3166-1 alpha-2 code (e.g. `IN`); UI displays the full name |
| `timezone` | String | Yes | IANA timezone (e.g. `Asia/Kolkata`); pre-filled from the registering admin's browser and editable. Used to calculate overdue tasks (see 4.6) |
| `website` | String | No | Valid `http(s)` URL; max 200 characters |
| `description` | String | No | Max 500 characters |
| `status` | Enum | Yes | `pending_approval` / `active` / `rejected` / `suspended`; default `pending_approval` |
| `statusHistory` | Array | Yes | `[{ status, reason?, changedBy: ObjectId → users, changedAt: Date }]`; one entry per status change. The current rejection / suspension reason is the latest entry's `reason` (single source of truth) |
| `createdBy` | ObjectId → users | Yes | User who submitted the organization |
| `updatedBy` | ObjectId → users | No | Last user (Tenant Admin or Application Owner) who edited organization details |
| `adminsVersion` | Number | Yes | Default `0`; system-managed. Incremented inside every transaction that changes the set of Tenant Admins, forcing concurrent admin changes to conflict (see 4.3) |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Not stored:** member count — computed from `memberships` when needed, to avoid counter drift.

**Indexes:** `{ status: 1, createdAt: 1 }` (Application Owner list filtered by status, oldest first); `{ name: 1 }` (search).

**Rule:** `updatedBy` is used only on collections whose changes are not recorded in the activity log.

### 4.3 `memberships` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `userId` | ObjectId → users | Yes | |
| `role` | Enum | Yes | `admin` / `project_manager` / `member` |
| `updatedBy` | ObjectId → users | No | Last Tenant Admin who changed this member's role |
| `createdAt` / `updatedAt` | Date | Yes | `createdAt` is the join date |

**Indexes:** unique `{ organizationId: 1, userId: 1 }` (permission check on every request); `{ userId: 1 }` (organization switcher); `{ organizationId: 1, role: 1 }` (admin count for R1).

**Rules:**
- Removing a member or leaving deletes the membership (DM-8). The user account remains, so their comments and activity still display their name.
- The inviter is not copied here; it remains on the invitation.
- **Last-admin race (write skew):** two admins demoting or removing each other concurrently could each see "another admin exists" and leave zero admins. Every transaction that removes, demotes or promotes an admin also increments `organizations.adminsVersion`, so concurrent transactions conflict on the same document; the retried transaction re-checks the admin count and is refused.

### 4.4 `invitations` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `email` | String | Yes | Stored lowercase and trimmed |
| `role` | Enum | Yes | `admin` / `project_manager` / `member`; always `member` when the inviter is a Project Manager (R11) |
| `projectIds` | ObjectId[] → projects | No | Pre-selected projects; default `[]` |
| `tokenHash` | String | Yes | Unique; SHA-256 hash of the token in the invitation link |
| `status` | Enum | Yes | `pending` / `accepted` / `revoked` |
| `expiresAt` | Date | Yes | 7 days after the invitation was last sent |
| `invitedBy` | ObjectId → users | Yes | Inviter |
| `lastSentAt` | Date | Yes | Time the invitation email was last sent |
| `acceptedBy` | ObjectId → users | No | Set on acceptance |
| `acceptedAt` | Date | No | |
| `revokedBy` | ObjectId → users | No | Absent when revoked automatically by the system (R12) |
| `revokedAt` | Date | No | |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Indexes:** unique `{ tokenHash: 1 }`; partial unique `{ organizationId: 1, email: 1 }` where `status = "pending"` (FR-INV-04); `{ organizationId: 1, status: 1, createdAt: -1 }` (admin list); `{ organizationId: 1, invitedBy: 1 }` (Project Manager's own invitations).

**Rules:**
- **Expired is computed, not stored:** an invitation is expired when `status = pending` and `expiresAt` is in the past. No background job is required.
- **Resend reuses the document:** a new token replaces `tokenHash`, `expiresAt` resets to 7 days and `lastSentAt` is updated; the previous link stops working.
- **Resend cooldown:** at most one resend per 5 minutes per invitation, based on `lastSentAt`.
- **Re-inviting an email with an expired invitation** reuses that document (new token, role, projects and expiry) instead of creating a second pending invitation.
- Invitations are retained as history (no TTL).

### 4.5 `projects` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `name` | String | Yes | Trimmed; 2–100 characters; unique within the organization, case-insensitive (including archived projects). Different organizations may use the same name |
| `description` | String | No | Max 2,000 characters |
| `managerId` | ObjectId → users | No | Must hold the Project Manager or Tenant Admin role; may be unset by R6 |
| `memberIds` | ObjectId[] → users | Yes | Embedded (DM-2); always includes the manager |
| `status` | Enum | Yes | `active` / `archived`; default `active` |
| `createdBy` | ObjectId → users | Yes | |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Indexes:** unique `{ organizationId: 1, name: 1 }` with case-insensitive collation (strength 2); `{ organizationId: 1, memberIds: 1 }` (projects a user belongs to).

**Rules:**
- Every `memberIds` entry must be a member of the same organization (NFR-ISO-05).
- Changing the manager adds the new manager to `memberIds`.
- When a user leaves or is removed from the organization, they are removed from every project's `memberIds` in the same transaction (with R5).
- **Not stored:** project summary (computed from tasks by aggregation); archive date and actor (available from the activity log). No `updatedBy` — project changes are recorded in the activity log.

### 4.6 `tasks` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `projectId` | ObjectId → projects | Yes | Must belong to the same organization |
| `title` | String | Yes | Trimmed; 1–200 characters |
| `description` | String | No | Plain text, line breaks preserved; max 5,000 characters |
| `status` | Enum | Yes | `todo` / `in_progress` / `in_review` / `done`; default `todo` |
| `priority` | Enum | Yes | `low` / `medium` / `high` / `urgent`; default `medium` |
| `assigneeId` | ObjectId → users | No | Must be a member of the task's project (R4) |
| `dueDate` | Date | No | Calendar date only, stored as UTC midnight of that date |
| `flag` | Object | No | Absent = not flagged. `{ type: "blocked" \| "on_hold", reason: String (1–500), setBy: ObjectId → users, setAt: Date }` (R15, R16) |
| `createdBy` | ObjectId → users | Yes | Used for Team Member edit permission |
| `version` | Number | Yes | Default `0`; incremented on every change; optimistic concurrency control (API design, Section 6) |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Indexes:** `{ organizationId: 1, projectId: 1, status: 1 }` (board and summary); `{ organizationId: 1, assigneeId: 1, status: 1 }` (My Tasks); `{ organizationId: 1, projectId: 1, "flag.type": 1 }` (Blocked tasks dialog and count).

**Rules:**
- **Priority sorting:** priorities are stored as readable strings; the server sorts board cards with a rank map (`urgent` 0, `high` 1, `medium` 2, `low` 3), then by due date with tasks without a due date last.
- **Overdue:** a task is overdue when it is not `done` and its due date is earlier than the current date in the **organization's timezone**. Board and summary use the same calculation.
- **Assignment history** (who assigned, when) is read from `task.assigned` activity entries; it is not duplicated on the task.
- **Status transitions** follow the review rule (R14): assignees move between `todo`, `in_progress` and `in_review`; only the project's manager or a Tenant Admin moves a task to `done`, requests changes (`in_review` → `in_progress` with a reason) or reopens it.
- **Flags:** a flagged task stays in its status column. Setting `done` removes the flag; `done` tasks cannot be flagged. While `flag.type = "blocked"`, the assignee cannot change the status, and only the project's manager or a Tenant Admin can clear the flag. Flag history is kept in the activity log (`task.flagged` / `task.unflagged`).
- **Deleting a task** deletes its comments and the notifications linking to it in one transaction; its activity entries are retained (FR-ACT-05), using the stored title snapshot.

### 4.7 `comments` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `projectId` | ObjectId → projects | Yes | Enables project-level cascade delete and permission checks without a task lookup |
| `taskId` | ObjectId → tasks | Yes | |
| `authorId` | ObjectId → users | Yes | |
| `body` | String | Yes | Plain text; 1–2,000 characters |
| `editedAt` | Date | No | Set when edited; displays the "edited" label |
| `createdAt` / `updatedAt` | Date | Yes | Automatic timestamps |

**Indexes:** `{ organizationId: 1, taskId: 1, createdAt: 1 }`; `{ organizationId: 1, projectId: 1 }` (cascade delete).

**Rule:** deleted comment text is not retained anywhere; the `comment.deleted` activity records only the actor and time.

### 4.8 `activities` — Locked (append-only)

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key |
| `projectId` | ObjectId → projects | Yes | |
| `taskId` | ObjectId → tasks | No | Absent for project-level events |
| `actorId` | ObjectId → users | Yes | User who performed the action |
| `action` | Enum | Yes | `task.created`, `task.updated`, `task.status_changed`, `task.changes_requested`, `task.flagged`, `task.unflagged`, `task.assigned`, `task.unassigned`, `task.deleted`, `comment.added`, `comment.deleted`, `project.created`, `project.updated`, `project.archived`, `project.restored`, `project.member_added`, `project.member_removed` |
| `changes` | Object | No | `{ <field>: { from, to } }` |
| `reason` | String | No | Required for `task.changes_requested` and `task.flagged`; max 500 characters |
| `snapshot` | Object | Yes | `{ projectName, taskTitle? }` captured at the time of the action (DM-4) |
| `createdAt` | Date | Yes | No `updatedAt` — entries are never modified |

**Indexes:** `{ organizationId: 1, projectId: 1, createdAt: -1 }` (project feed); `{ organizationId: 1, taskId: 1, createdAt: -1 }` (task history).

**Rules:** entries are never edited or deleted except through project deletion (FR-ACT-05). Snapshots keep the values at the time of the action; renamed tasks show their old title in older entries, while links open the current task.

### 4.9 `notifications` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `organizationId` | ObjectId → organizations | Yes | Tenant key; notifications are shown per active organization |
| `recipientId` | ObjectId → users | Yes | |
| `type` | Enum | Yes | `task.assigned`, `task.unassigned`, `task.status_changed`, `task.submitted_for_review`, `task.changes_requested`, `task.blocked`, `task.unblocked`, `comment.added`, `project.member_added`, `project.member_removed`, `project.tasks_unassigned`, `project.manager_unset` (FR §12.1) |
| `actorId` | ObjectId → users | No | User who triggered the event |
| `projectId` | ObjectId → projects | No | Link target |
| `taskId` | ObjectId → tasks | No | Link target |
| `data` | Object | Yes | Display snapshot, e.g. `{ taskTitle, projectName, count, memberName, reason }` |
| `readAt` | Date | No | Absent = unread |
| `createdAt` | Date | Yes | TTL: deleted 90 days after creation (DM-7) |

**Indexes:** `{ organizationId: 1, recipientId: 1, createdAt: -1 }` (list); `{ organizationId: 1, recipientId: 1, readAt: 1 }` (unread count); TTL `{ createdAt: 1 }` with `expireAfterSeconds: 7776000`.

**Rules:**
- Notification text is built by the frontend from `type` and `data`; no rendered text is stored.
- One notification per event, not per affected item (e.g. R5 produces one `project.tasks_unassigned` notification with a `count`).
- One notification per recipient per action: the most specific type wins (e.g. a change request sends `task.changes_requested`, not also `task.status_changed`).

### 4.10 `refreshTokens` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `userId` | ObjectId → users | Yes | |
| `familyId` | String | Yes | Shared by all tokens issued from one login |
| `tokenHash` | String | Yes | Unique; SHA-256 hash of the refresh token |
| `expiresAt` | Date | Yes | 7 days after issue (inactivity limit); TTL index |
| `familyExpiresAt` | Date | Yes | 30 days after the original login (absolute limit); copied to each rotated token |
| `replacedAt` | Date | No | Set when rotated; used for reuse detection and the grace period |
| `revokedAt` | Date | No | Set on logout, password change / reset or detected reuse |
| `createdAt` | Date | Yes | |

**Indexes:** unique `{ tokenHash: 1 }`; `{ userId: 1 }` (revoke all on password change); `{ familyId: 1 }` (revoke family); TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.

**Rules:**
- **Rotation:** every refresh issues a new token in the same family and sets `replacedAt` on the old one.
- **Reuse detection:** presenting a token that was replaced more than **10 seconds** ago revokes the entire family. Within the 10-second grace period the request receives a plain 401 without revocation (concurrent refreshes from multiple tabs).
- A refresh is refused after `expiresAt` (7 days of inactivity) or `familyExpiresAt` (30 days absolute).

### 4.11 `userTokens` — Locked

| Field | Type | Required | Rules / Notes |
|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated |
| `userId` | ObjectId → users | Yes | |
| `type` | Enum | Yes | `email_verification` / `password_reset` |
| `tokenHash` | String | Yes | Unique; SHA-256 hash of the token in the email link |
| `expiresAt` | Date | Yes | 24 hours (verification) / 1 hour (reset); TTL index |
| `usedAt` | Date | No | Set on use; tokens are single-use |
| `createdAt` | Date | Yes | |

**Indexes:** unique `{ tokenHash: 1 }`; `{ userId: 1, type: 1 }`; TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.

**Rule:** issuing a new token invalidates the user's previous unused tokens of the same type, so only the latest link works.
