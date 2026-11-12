# System Architecture

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.1 — System Architecture  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the overall structure of Nexora: its main components, how they communicate, and how the codebase is organized.

## 2. Decisions

| ID | Decision | Alternatives Considered | Reason |
|---|---|---|---|
| ARC-1 | **Modular monolith** backend | Microservices | One developer, 8 weeks: avoids multiple deployments, network calls between services and distributed transactions, while keeping clear module boundaries that could be extracted later |
| ARC-2 | **Monorepo** with npm workspaces | Separate repositories | Shared types and validation schemas between client and server; one CI pipeline |
| ARC-3 | **Vite + React** single-page application | Next.js | All pages are behind login; no SSR or SEO requirement; keeps the backend in one place |
| ARC-4 | **REST API** under `/api/v1` | GraphQL | Simpler to secure per endpoint, cache and test; matches the selected stack |
| ARC-5 | **Shared package** for Zod schemas, types and permission rules | Duplicated logic | Client and server can never disagree on validation or permissions |

## 3. Components

```
Browser — React SPA (Vite, TypeScript, Tailwind, shadcn/ui)
   │  HTTPS, JSON — /api/v1 (same origin via Vercel rewrite)
   ▼
Express API (Node.js, TypeScript) — modular monolith
   ├── Middleware: request ID, security headers, rate limiting,
   │               authenticate → tenant → membership → status → authorize → validate
   ├── Modules (routes → controllers → services → repositories)
   │
   ├──► MongoDB Atlas (replica set; transactions)
   ├──► Cloudinary (avatars)
   └──► SMTP provider (Gmail) (verification, reset, invitations, approval emails)
```

## 4. Repository Structure

```
nexora/
  client/              React SPA
  server/              Express API
  packages/
    shared/            Zod schemas, TypeScript types, permission functions (can())
  docs/                Phase documentation
  package.json         npm workspaces
```

## 5. Backend Modules

| Module | Responsibility |
|---|---|
| `auth` | Registration, verification, login, refresh, logout, password reset / change |
| `users` | Profile and avatar |
| `organizations` | Registration, details, resubmission |
| `platform` | Application Owner organization management |
| `memberships` | Members, roles, removal, leaving, last-admin protection |
| `invitations` | Single / bulk invitations, resend, revoke, accept, register |
| `projects` | Projects, project members, manager, archive, summary, board |
| `tasks` | Tasks, status workflow, assignment, flags, My Tasks |
| `comments` | Task comments |
| `activity` | Activity recording and feeds |
| `notifications` | Notification creation, listing and read state |
| `common` | Tenant-scoped repository base, transactions, errors, email, storage, logging |

### 5.1 Layering

| Layer | Responsibility | Must not |
|---|---|---|
| Routes | URL, middleware chain, schema validation | Contain business logic |
| Controllers | Translate HTTP to service calls and responses | Access the database |
| Services | Business rules, transactions, activity and notifications | Know about HTTP |
| Repositories | Database access, always tenant-scoped | Contain business rules |

**Module boundary rule:** a module uses another module only through that module's service, never by accessing its models directly.

## 6. Cross-Cutting Concerns

| Concern | Approach | Reference |
|---|---|---|
| Tenant isolation | `organizationId` in URL, membership verification, tenant-scoped repositories | Step 3.2 |
| Authentication | JWT access token + rotating refresh token cookie | Step 3.4 |
| Validation | Zod schemas from `packages/shared` | Step 3.5 |
| Errors | Central error handler, standard error format | Step 3.5 |
| Transactions | `withTransaction` helper for multi-document changes | NFR-REL-01 |
| Logging | pino structured logs with request ID | NFR-OPS-03 |

**Next step:** Step 3.2 — Tenancy and Authorization Design.
