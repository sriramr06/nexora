# Security and Performance Review

**Date:** 16 November 2026 (Sprint 7)  
**Scope:** the MVP as merged on `main`, checked against NFR-SEC, NFR-PERF and the authentication threat table.

## 1. Security requirements

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| NFR-SEC-01 | bcrypt ≥ 12, no plain-text passwords | Met | `config/auth.ts` (`bcryptCost: 12`); logs redact `password`, `token`, the `Authorization` header and cookies (`common/logger.ts`) |
| NFR-SEC-02 | Access 15 min; refresh 7 days, httpOnly / Secure / SameSite, rotated, revocable | Met | `accessTokenTtl: "15m"`, `refreshTokenTtlMs` 7 days; cookie `httpOnly`, `secure` in production, `sameSite: "lax"`, path `/api/v1/auth`; rotation with family revocation and a 10 s grace window |
| NFR-SEC-03 | JWT carries identity only; roles read per request | Met | `jwt.sign({ sub })`; `loadTenant` reads the membership on every tenant request |
| NFR-SEC-04 | Emailed tokens random, single-use, time-limited, hashed | Met | `common/crypto/tokens.ts`: 32 random bytes, stored as SHA-256; TTL indexes; consumed atomically |
| NFR-SEC-05 | Schema validation; unknown fields and operators rejected | Met (one deviation) | Every body, query and path parameter goes through Zod. A MongoDB operator such as `{ "$gt": "" }` fails because fields are typed. **Deviation:** unknown fields are *stripped*, not rejected with 400. They can never reach the database, and stripping keeps older clients working. |
| NFR-SEC-06 | User text rendered as plain text | Met | No `dangerouslySetInnerHTML` in the client; e2e and API tests post `<img onerror>` and check nothing is injected |
| NFR-SEC-07 | Auth rate limits | Met | Login 10 per 15 min per IP + email; register, forgot-password and resend-verification 5 per hour; public invitation endpoints 20 per 15 min |
| NFR-SEC-08 | Security headers; CORS allowlist | Met (stricter) | Helmet on every response. **No CORS at all:** the client calls the API through the Vercel rewrite (same origin), so browsers refuse every cross-origin call. `/api/docs` has its own policy allowing only the pinned Swagger CDN build. |
| NFR-SEC-09 | HTTPS in production | Met | Vercel and Render terminate TLS; the cookie is `Secure` |
| NFR-SEC-10 | Secrets only in the environment | Met | `.env` is git-ignored; no `.env` file in the repository; CI uses GitHub secrets |
| NFR-SEC-11 | Avatar type and size checks; no storage credentials on the client | Met | 2 MB multer limit; magic-byte check; re-encoded by sharp (pixel limit 40 M) to WebP; stored in MongoDB, served by the API |
| NFR-SEC-12 | Auth errors don't reveal registered emails | Met (accepted exception) | Login and reset answer generically. Registration says an email is taken — accepted in AU-11, mitigated by the rate limit |

## 2. Tenant isolation

- Every tenant document carries `organizationId`; the `tenantScoped` plugin throws on any query without it.
- The cross-tenant harness calls **all 46 tenant endpoints** as a member of another organization and expects 404.
- Notifications, comments and activity are scoped the same way; another user's notification is 404.

## 3. Dependencies

`npm audit --omit=dev` reports 6 issues (2 low, 4 moderate), all inside the **shadcn CLI** (`deepmerge`, `minimatch` via `ts-morph`). The app uses only a CSS file from that package at build time; none of that code runs on the server or ships to the browser. Accepted. Follow-up: move `shadcn` to `devDependencies` once npm's workspace install bug is out of the way.

## 4. Performance

Measured locally against the e2e stack (in-memory MongoDB), a project with **200 tasks**:

| Check | Target | Result |
|---|---|---|
| `GET …/board` (200 tasks, 91 KB) | 95% under 500 ms (NFR-PERF-01) | median 17 ms, max 18 ms |
| `GET …/summary` (aggregation) | same | median 12 ms |
| `GET …/my-tasks?limit=50` | same | median 11 ms |
| Board with 200 tasks, click → last card rendered | under 2 s (NFR-PERF-02) | **1.48 s** in the unoptimised dev build |
| Notification polling | ≤ every 30 s, visible tab only (NFR-PERF-05) | `refetchInterval: 30_000`; TanStack Query pauses in hidden tabs |

**Note:** the board endpoint returns a whole project rather than pages (NFR-PERF-03 applies to lists); at a few hundred tasks per project it stays small. If projects grow into the thousands, paginate per column.

## 5. Follow-ups (not blocking the MVP)

1. Move `shadcn` to `devDependencies` (section 3).
2. A shared rate-limit store (e.g. Redis) before running more than one API instance.
3. Paginate board columns if projects exceed ~1,000 tasks.
