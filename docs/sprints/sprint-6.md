# Sprint 6 — Notifications, Rules and Polish

**Dates:** 28 – 30 November 2026 (plan v1.1; built 15 Nov)  
**Goal:** collaboration signals and complete business rules.

## Decisions

1. **Where notifications live:** a bell in the header with an unread badge and the latest items, plus a full Notifications page with "Load more".
2. **Projects without a manager (R6):** submissions and blockers go to every Tenant Admin, since admins can act on any project.
3. **Project activity feed:** an Activity tab on the project page, newest first, "Load older activity".

## Backend

- [x] `notify()` — the single way notifications are created, inside the change's transaction (INT-5); drops the actor (FR-NOT-02), dedupes, most specific type wins
- [x] Events (FR §12.1): assigned / unassigned, status changed, submitted for review, changes requested, blocked / unblocked, comment added, project member added / removed
- [x] R5 with notification: one `project.tasks_unassigned` per project with a count; R6: one `project.manager_unset` per project to all admins
- [x] List (cursor), unread count, mark one / all read; 90-day TTL (DM-7)
- [x] Project activity feed `GET /projects/:id/activity` (FR-ACT-04)
- [x] Task and project deletes remove linked notifications
- [x] Shared keyset cursor helper (activity, comments, notifications)
- [x] Cross-tenant harness: 46 tenant endpoints

## Client

- [x] Notification bell: unread badge polled every 30 s while the tab is visible (NFR-PERF-05); list loads only when opened
- [x] Opening a notification marks it read (optimistic) and goes to the task or project
- [x] Notifications page with empty / loading / error states and "Load more"
- [x] Project Activity tab with task links and title snapshots
- [x] Responsive: header fits at 360 px (Account link folds into the avatar)
- [x] Browser-checked: badge counts, menu, open → read, blocker reaches the manager, mark all read, activity tab, dark mode, 360 px

## Stories

- [x] US-15 (cascades with notifications)
- [x] US-29 View activity history
- [x] US-30 Receive notifications
- [x] Notification parts of US-25 / 28 / 36 – 38

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
