# Sprint 4 — Projects and Tasks Core

**Dates:** 20 – 23 November 2026 (plan v1.1; built 12 Nov)  
**Goal:** projects and tasks work end to end with history.

## Decisions (12 Nov 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Task view before the Kanban board (Sprint 5) | Task **list grouped by status** now; in Sprint 5 the board becomes the default and the list stays as an alternative |
| — | Defaults applied | Task details in a side panel with its own URL; delete project by typing its name; "someone changed this task — load latest" on conflicts; My Tasks excludes archived projects |
| — | R5 / R6 data cascades | Pulled forward from Sprint 6 now that projects exist (unassign open tasks, unset manager, remove from project members). Notifications stay in Sprint 6 |

## Backend

- [x] `projects`, `tasks`, `activities` models (case-insensitive unique project name per organization)
- [x] Projects: create (PM manages own; admin picks manager, R3), list by access, view, update, manager, members (NFR-ISO-05), archive / restore (R7), delete with cascade
- [x] Tasks: create (R4, Team Member self-assign), view, edit, assign, delete — every change version-checked (`409 VERSION_CONFLICT`)
- [x] Activity recorded in the same transaction (FR-ACT-02); task history with keyset cursor pagination
- [x] My Tasks: across active projects, soonest due first; overdue in the organization's timezone (FR-TASK-10)
- [x] R5 / R6 data cascades on project and organization membership changes
- [x] Invitation project pre-selection (R11, R13) — moved from Sprint 3
- [x] `can()` for project and task actions; cross-tenant harness: 30 tenant endpoints

## Client

- [x] Projects page (cards with progress, filters, new-project dialog with manager choice for admins)
- [x] Project page: task list grouped by status, new-task dialog, members tab (add / remove), edit, archive / restore, type-to-delete
- [x] Task side panel at `/o/:orgId/tasks/:taskId`: edit with conflict handling, assignee control per role ("Assign to me"), delete, history in plain sentences
- [x] My tasks page with status filter and overdue count; Overview shows my tasks, projects and team
- [x] Invite form: project picker (PMs see only projects they manage)
- [x] Browser-checked end to end, including a real edit conflict between two users; 360 px

## Stories

- [x] US-17 Create a project
- [x] US-18 Manage project members
- [ ] US-19 View project progress → Sprint 5 (summary with the board)
- [x] US-20 Archive or delete a project
- [x] US-21 Create a task
- [x] US-22 Assign and reassign tasks (notifications → Sprint 6)
- [x] US-23 Pick up an unassigned task
- [x] US-24 Edit task details
- [x] US-27 See my tasks
- [x] US-34 Invite members to my project (project pre-selection)

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
