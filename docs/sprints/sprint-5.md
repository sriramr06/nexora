# Sprint 5 — Kanban and Workflow

**Dates:** 24 – 27 November 2026 (plan v1.1; built 12 Nov)  
**Goal:** the board and the review / blocker workflow.

## Decisions

No open questions — the review rule (R14), flags (R15, R16), board and comments were fully designed in Phase 3. Notification parts of these stories ("the manager is notified") are Sprint 6.

## Backend

- [x] Shared workflow rules (`packages/shared/src/workflow.ts`): each move returns OK or a human reason; the server enforces it and the board reuses the reason
- [x] Status changes (assignee: To Do ↔ In Progress → In Review / withdraw; manager: approve, reopen), request changes with reason
- [x] Flags: Blocked / On hold with reason; Done clears flags and cannot be flagged; assignee frozen while Blocked
- [x] Board grouped by status, sorted by priority then due date; filters (assignee incl. unassigned, priority, flag)
- [x] Project summary by aggregation (counts, overdue in org timezone, blocked, % complete); blocked-tasks list
- [x] Comments: add, list oldest first, edit own ("edited"), delete (author / manager / admin); cascade with task and project
- [x] Cross-tenant harness: 41 tenant endpoints

## Client

- [x] Board (default project view) with dnd-kit: pointer and keyboard dragging, optimistic moves with rollback, refused drops explained
- [x] "Move to" menu on each card (non-drag path, FR-BOARD-04)
- [x] Filters, summary strip, Blocked tasks dialog
- [x] Task panel: status actions in workflow words (Start work, Submit for review, Approve, Request changes, Reopen), flag controls, comments
- [x] Router error page (no developer error screen for users)
- [x] Browser-checked: real drags, refused drops, menu moves, block / unblock, request changes, approve, HTML comment as text, filters, dark mode, 360 px

## Stories

- [x] US-19 View project progress
- [x] US-25 Move tasks on the board
- [x] US-26 Filter the board
- [x] US-28 Comment on a task
- [x] US-36 Review submitted work
- [x] US-37 Report a blocker or put a task on hold
- [x] US-38 Resolve blocked tasks
- [ ] Notifications in US-25 / 28 / 36 – 38 → Sprint 6

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
