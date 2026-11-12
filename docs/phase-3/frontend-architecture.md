# Frontend Architecture

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.6 — Frontend Architecture  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the structure of the React client: state management, routing, API access, forms, UI components and permission-aware rendering.

## 2. Technology Decisions

| ID | Concern | Choice | Reason |
|---|---|---|---|
| FE-1 | Build tool | Vite + React + TypeScript | Single-page app behind login; no SSR or SEO needed |
| FE-2 | Server state | **TanStack Query** | Caching, loading / error states, refetching, polling and optimistic updates |
| FE-3 | Client state | **Zustand** | Small store for access token (memory only), current user and UI state; no Redux |
| FE-4 | Routing | React Router | Nested routes and route guards |
| FE-5 | HTTP client | **axios** with interceptors | Central auth header, single-flight token refresh and retry |
| FE-6 | Forms | **React Hook Form + Zod** | Same Zod schemas as the server, from `packages/shared` |
| FE-7 | UI components | **shadcn/ui** (Base UI + Tailwind; theme in `ui-theme.md`) | Accessible dialogs, menus and popovers; source owned in the repo; MIT licence |
| FE-8 | Drag and drop | **dnd-kit** | Maintained; keyboard dragging support (NFR-USE-02) |
| FE-9 | Permissions | Shared `can()` function in `packages/shared` | Backend and frontend use the same permission rules |
| FE-10 | Folder structure | Feature-based | Mirrors backend modules; related code stays together |

## 3. State Management

| Type | Examples | Tool |
|---|---|---|
| Server state | Projects, tasks, members, notifications, summary | TanStack Query cache |
| Client state | Access token, current user, sidebar open, active filters | Zustand / component state |
| URL state | Active organization, project, task, board filters | React Router (path and query string) |

**Rules:**
- Server data is never copied into Zustand; components read it through query hooks.
- Mutations invalidate or update the affected queries (e.g. a status change updates the board and the project summary).
- Query keys include the organization ID, e.g. `["orgs", orgId, "projects", projectId, "board"]`, so switching organization never shows another tenant's cached data. The cache is cleared on logout.

## 4. Kanban Board Behavior

1. The card moves immediately (optimistic cache update).
2. `POST /tasks/:taskId/status` is sent with `{ status, version }`.
3. On success the server response replaces the optimistic value.
4. On `403`, `409 INVALID_TRANSITION`, `409 TASK_BLOCKED` or `409 VERSION_CONFLICT`, the card returns to its original column and a message explains why; on `VERSION_CONFLICT` the board is refetched.

A keyboard / menu alternative ("Move to…") performs the same mutation.

## 5. Routes

| Path | Access | Page |
|---|---|---|
| `/login`, `/register`, `/forgot-password` | Public | Auth pages |
| `/verify-email?token=`, `/reset-password?token=`, `/invite?token=` | Public | Token pages (token sent to the API in the body) |
| `/` | Public / User | Landing page for visitors (UI-6); logged-in users go to the last used organization (kept in `localStorage`, falling back to the first membership) or `/welcome` |
| `/welcome` | User | No memberships: register an organization or wait for an invitation |
| `/organizations/new` | Verified | Organization registration form |
| `/account` | User | Profile, avatar, change password |
| `/o/:orgId` | Tenant | Dashboard |
| `/o/:orgId/my-tasks` | Tenant | My Tasks |
| `/o/:orgId/projects` | Tenant | Project list |
| `/o/:orgId/projects/:projectId` | Project access | Board (default project view) |
| `/o/:orgId/projects/:projectId/overview` | Project access | Summary and activity feed |
| `/o/:orgId/projects/:projectId/settings` | Admin / manager | Details, members, archive, delete |
| `/o/:orgId/tasks/:taskId` | Project access | Task detail side panel over its board (deep-linkable) |
| `/o/:orgId/members` | Tenant | Members |
| `/o/:orgId/invitations` | Admin / PM | Invitations |
| `/o/:orgId/settings` | Tenant Admin | Organization settings |
| `/platform/organizations`, `/platform/organizations/:id` | Owner | Platform administration |

**Route guards:** `RequireAuth` (redirect to `/login`), `RequireVerified`, `RequireOwner`, and `OrgGate`, which loads the organization and membership and shows the Awaiting approval, Rejected (with edit and resubmit) or Suspended page when the organization is not active.

## 6. API Client

- A single axios instance with `baseURL: "/api/v1"` (same origin through the Vercel / Vite proxy).
- **Request interceptor:** attaches the in-memory access token.
- **Response interceptor:** on `401 TOKEN_EXPIRED`, performs one refresh at a time; concurrent requests wait and are retried after the refresh. A failed refresh clears the session and redirects to `/login`.
- On startup the app calls `/auth/refresh` to restore the session before rendering protected routes.
- Errors are normalized to the API error format so components can react to `error.code`.

## 7. Forms

- React Hook Form with the Zod resolver, using schemas imported from `packages/shared`.
- Server `VALIDATION_ERROR` details are mapped back to form fields.
- Destructive actions use a confirmation dialog (NFR-USE-05).

## 8. Permission-Aware UI

- `packages/shared` exports pure permission functions, e.g. `can(actor, "task.approve", context)`, implementing the Roles document matrix and rules R1–R16.
- The backend `authorize` middleware and the frontend both call these functions.
- The UI hides or disables actions the user cannot perform; **the backend remains the only enforcement point**.

## 9. Polling

- Unread notification count: every 30 seconds, only while the tab is visible (TanStack Query `refetchInterval`, no background refetch) — NFR-PERF-05.
- Other data refreshes on window focus and after mutations.

## 10. Folder Structure

```
client/src/
  app/              router, providers, layouts, route guards
  features/
    auth/           pages, components, hooks (queries / mutations)
    organizations/
    platform/
    members/        including invitations
    projects/
    tasks/          board, task panel, my tasks
    notifications/
    account/
  components/ui/    shadcn/ui components
  lib/              api client, query client, auth store, utilities
```

**Next step:** Step 3.7 — Integrations.
