# Deployment and CI

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.8 — Deployment and CI  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define the environments, hosting, continuous integration, deployment process and operational practices for Nexora within a budget-conscious setup.

## 2. Decisions

| ID | Decision |
|---|---|
| DEP-1 | Three environments: **local**, **CI / test** and **production**. No staging environment. |
| DEP-2 | Separate MongoDB Atlas free (M0) clusters for **development** and **production**, in separate Atlas projects. |
| DEP-3 | Frontend on **Vercel**; API on **Render**; both reached through the Vercel domain via the `/api` rewrite (AU-12). |
| DEP-4 | Region: **Render Singapore** and **Atlas AWS Singapore**, co-located to minimise database latency. |
| DEP-5 | Vercel preview deployments are **disabled** (previews would proxy to the production API). |
| DEP-6 | Auto-deploy is **disabled** on Vercel and Render. GitHub Actions deploys only after all CI checks pass. |
| DEP-7 | `main` is protected; changes arrive through pull requests with passing CI. Conventional Commits. |
| DEP-8 | End-to-end tests run on `main` only; all other checks run on every push and pull request. |
| DEP-9 | Production indexes are managed by an explicit script; Mongoose `autoIndex` is disabled in production. |
| DEP-10 | Backups are taken manually with a `db:backup` script (`mongodump`) before risky deployments; the free tier provides no automated backups. |

## 3. Architecture

```
GitHub (main) ──► GitHub Actions: lint → typecheck → test → build
                                   │ all checks pass
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
              Vercel (client)              Render (server)
              nexora-six-rouge.vercel.app            nexora-5crt.onrender.com
              /api/* ── rewrite ─────────► /api/*
                                                 │
                              MongoDB Atlas (prod) · Cloudinary · Brevo SMTP
```

## 4. Environments

| | Local | CI / Test | Production |
|---|---|---|---|
| Client | Vite dev server (proxies `/api` to the local API) | — | Vercel |
| API | `npm run dev` | In-process (Supertest) | Render web service |
| Database | Atlas dev cluster | mongodb-memory-server replica set | Atlas prod cluster |
| Email | `ConsoleEmailService` | `FakeEmailService` | `SmtpEmailService` (Brevo) |
| Cloudinary folder | `nexora/development` | Mocked | `nexora/production` |

**Database tools:** MongoDB Compass may be used to inspect the dev cluster. Data is changed only through the application or seed scripts, never edited manually, to avoid bypassing business rules, activity and notifications. Production access through Compass uses a **read-only** database user.

## 5. Hosting Configuration

### 5.1 Vercel (client)

- Root directory: `client`; build output: `dist`.
- `client/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://nexora-5crt.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- The `/api` rule must come first. The catch-all rule serves `index.html` for client-side routes, so refreshing a deep link (e.g. `/o/123/my-tasks`) does not return 404.

### 5.2 Render (server)

- Web service, Singapore region; build command builds `packages/shared` then `server`.
- Health check path: `/api/v1/health`.
- Express `trust proxy` enabled (real client IP from `X-Forwarded-For`).
- Free-tier instances sleep when idle; the first request afterwards can take up to about a minute. Before demos, open the site in advance.

### 5.3 MongoDB Atlas

- M0 free clusters (replica sets — transactions supported) for dev and prod.
- Network access: Render free instances do not have fixed outbound IPs, so the production cluster allows all IPs and relies on a strong, unique database password and a least-privilege application user.
- Database users: application user (read / write on the Nexora database only); read-only user for inspection.

## 6. Continuous Integration (GitHub Actions)

| Step | Every push / PR | `main` only |
|---|---|---|
| `npm ci` | ✅ | ✅ |
| Lint and format check (ESLint, Prettier) | ✅ | ✅ |
| Typecheck (all workspaces) | ✅ | ✅ |
| Unit and integration tests, including cross-tenant and permission suites | ✅ | ✅ |
| Build (shared → server → client) | ✅ | ✅ |
| End-to-end tests (Playwright: J1, J3, J5) | | ✅ |
| Deploy | | ✅ (only if all above pass) |

## 7. Deployment Process

1. A pull request is merged into `main`.
2. GitHub Actions runs all checks, including end-to-end tests.
3. If every check passes:
   1. `db:sync-indexes` runs against production.
   2. The Render **deploy hook** (stored as a GitHub secret) triggers the API deployment.
   3. The **Vercel CLI** (token stored as a GitHub secret) deploys the client.
4. If any check fails, nothing is deployed.

## 8. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run client and server locally |
| `npm run test` | Run all tests |
| `npm run db:sync-indexes` | Create / update indexes explicitly |
| `npm run db:seed` | Create the Application Owner; optional demo data (Acme, Priya, Arun, Meena) |
| `npm run db:backup` | `mongodump` of the target database to a local, git-ignored folder |

## 9. Operations

- **Logging:** structured JSON logs (pino) with `requestId`; passwords, tokens and secrets are never logged; viewed in the Render dashboard.
- **Health:** `/api/v1/health` reports API and database status.
- **Configuration:** `.env.example` files are committed with placeholder values; real values live in Vercel, Render and GitHub secrets.

**Next step:** Phase 3 review, then Phase 4 — Implementation Planning.
