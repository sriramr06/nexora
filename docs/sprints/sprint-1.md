# Sprint 1 — Foundations and Authentication

**Dates:** 6 – 15 November 2026  
**Goal:** a deployed skeleton with complete authentication.

## Setup

- [x] Monorepo (`client`, `server`, `packages/shared`), TypeScript strict, ESLint, Prettier, Vitest
- [x] GitHub Actions CI (lint, format, typecheck, test, build)
- [x] Walking skeleton runs locally (client → Vite proxy → API health)
- [x] First pull request merged
- [x] `main` protected by ruleset (PR + CI required)

## Learning

- [ ] TanStack Query (queries, mutations, invalidation, optimistic updates)
- [ ] Zustand (store, selectors)
- [ ] React Hook Form + Zod (recap)
- [ ] shadcn/ui (CLI, Button, Dialog, DropdownMenu, Form)

## Backend Foundations

- [x] Environment config validated with Zod
- [x] Request ID, security headers (Helmet), pino logging
- [x] Central error handler and standard error format (API design §3–4)
- [x] Request validation middleware (Zod)
- [x] MongoDB connection, graceful shutdown, `withTransaction` helper
- [ ] ~~Tenant-scoped repository base~~ → moved to Sprint 2 (built with the tenancy pipeline)
- [x] `db:sync-indexes` and `db:seed` script skeletons

## Client Foundations

- [x] React Router, TanStack Query provider, Zustand auth store
- [x] axios client with request interceptor
- [x] shadcn/ui initialised

## Deployment

- [x] Accounts: MongoDB Atlas (dev + prod), Render, Vercel (Brevo, Cloudinary: when needed)
- [x] API deployed on Render (Singapore) connected to Atlas prod
- [x] Client deployed on Vercel with `/api` rewrite; "API connected" in production
- [x] Deploy-after-CI job in GitHub Actions; auto-deploy disabled

## Authentication Stories

- [x] US-01 Register an account
- [x] US-02 Verify my email
- [x] US-03 Log in and out (refresh rotation, families, grace period)
- [x] US-04 Reset a forgotten password
- [x] US-05 Change my password
- [x] Email service: console, fake, SMTP
- [x] Rate limiting on auth endpoints
- [x] Client: auth pages, single-flight refresh interceptor, session restore, `RequireAuth`, `RequireVerified`

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
