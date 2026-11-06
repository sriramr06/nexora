# Sprint 1 — Foundations and Authentication

**Dates:** 6 – 15 November 2026  
**Goal:** a deployed skeleton with complete authentication.

## Setup

- [x] Monorepo (`client`, `server`, `packages/shared`), TypeScript strict, ESLint, Prettier, Vitest
- [x] GitHub Actions CI (lint, format, typecheck, test, build)
- [x] Walking skeleton runs locally (client → Vite proxy → API health)
- [ ] First pull request merged; `main` protected (PR + CI required)

## Learning

- [ ] TanStack Query (queries, mutations, invalidation, optimistic updates)
- [ ] Zustand (store, selectors)
- [ ] React Hook Form + Zod (recap)
- [ ] shadcn/ui (CLI, Button, Dialog, DropdownMenu, Form)

## Backend Foundations

- [ ] Environment config validated with Zod
- [ ] Request ID, security headers (Helmet), pino logging
- [ ] Central error handler and standard error format (API design §3–4)
- [ ] MongoDB connection, `withTransaction` helper
- [ ] Tenant-scoped repository base
- [ ] `db:sync-indexes` and `db:seed` script skeletons

## Client Foundations

- [ ] React Router, TanStack Query provider, Zustand auth store
- [ ] axios client with request interceptor
- [ ] shadcn/ui initialised

## Deployment

- [ ] Accounts: MongoDB Atlas (dev + prod), Render, Vercel, Brevo, Cloudinary
- [ ] API deployed on Render (Singapore) connected to Atlas prod
- [ ] Client deployed on Vercel with `/api` rewrite; "API connected" in production
- [ ] Deploy-after-CI job in GitHub Actions; auto-deploy disabled

## Authentication Stories

- [ ] US-01 Register an account
- [ ] US-02 Verify my email
- [ ] US-03 Log in and out (refresh rotation, families, grace period)
- [ ] US-04 Reset a forgotten password
- [ ] US-05 Change my password
- [ ] Email service: console, fake, SMTP
- [ ] Rate limiting on auth endpoints
- [ ] Client: auth pages, single-flight refresh interceptor, session restore, `RequireAuth`, `RequireVerified`

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
