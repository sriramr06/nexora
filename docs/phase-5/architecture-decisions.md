# Architecture Decisions

The eight decisions that shape Nexora, each with what was chosen, why, and what it costs. The full designs are in `docs/phase-3`.

## ADR-1 Shared collections with an `organizationId` on every tenant document

- **Decision:** one database; every tenant-owned document carries `organizationId`. A Mongoose plugin (`tenantScoped`) throws on any query that lacks it, and a `forTenant(model, orgId)` repository adds it to every query and insert.
- **Why:** one schema and one set of indexes to manage, cheap on a free tier, and isolation enforced in one place instead of remembered in every query.
- **Cost:** a missed filter would leak data, so it is guarded twice: the plugin (fails loudly) and a cross-tenant test that calls all 46 tenant endpoints as an outsider and expects 404.
- **Alternatives:** a database per tenant (strong isolation, heavy to operate); row-level security (MongoDB has none).

## ADR-2 Short-lived JWT in memory + rotating refresh token in an httpOnly cookie

- **Decision:** a 15-minute access token kept in memory only; an opaque refresh token in an `httpOnly` cookie, rotated on every use, grouped in families. Reusing an old token revokes the family (with a 10 s grace window for parallel tabs).
- **Why:** XSS cannot read the refresh token; a stolen refresh token is detected the moment either party uses it; roles are not in the JWT, so a role change applies immediately.
- **Cost:** a refresh round-trip after reload; single-flight refresh logic in the client.

## ADR-3 History and notifications written in the same transaction as the change

- **Decision:** a change, its activity entry and its notifications are written together in one MongoDB transaction. `notify()` is the only way notifications are created; it drops the actor, dedupes and keeps the most specific event.
- **Why:** with post-commit events, a crash between commit and listener silently loses history. Here they commit together or not at all.
- **Cost:** needs a replica set (Atlas has one; tests use an in-memory replica set); services call `notify()` explicitly.

## ADR-4 Optimistic concurrency on tasks

- **Decision:** every task has a `version`. Updates say which version they saw; the database applies the update only if it still matches (`findOneAndUpdate` with the version in the filter) and returns 409 otherwise.
- **Why:** two people editing the same task can't silently overwrite each other; the board's optimistic moves roll back with an explanation.
- **Cost:** the client must send the version and handle 409.

## ADR-5 Business rules in a shared package used by both sides

- **Decision:** `packages/shared` holds Zod schemas, `can(actor, action, facts)` and the workflow rules (`statusChange`, `setFlag`, …), each returning OK or a human reason.
- **Why:** the server enforces exactly what the UI shows. A Team Member dropping a card on Done sees "Submit for review instead" before any request is sent, and the server would refuse it anyway. The OpenAPI document is generated from the same schemas, so the docs can't drift either.
- **Cost:** shared code must stay free of server- or browser-only imports.

## ADR-6 Invariants in the database, not only in `if` statements

- **Decision:** rules that must hold under concurrency are unique or partial indexes and atomic updates: one organization per user, one pending invitation per email per organization, at least one Tenant Admin (a version counter bumped in the transaction), compare-and-set status transitions.
- **Why:** two simultaneous requests both pass an `if` check; only the database can make one of them fail. Each has a race test.

## ADR-7 Polling for notifications, not WebSockets

- **Decision:** the unread count is polled every 30 s, only while the tab is visible; the list loads when opened.
- **Why:** one tiny count query per tab per 30 s, no extra infrastructure on a free tier, works through every proxy. Notifications are not chat; a 30 s delay is fine.
- **Upgrade path:** server-sent events from the same `notify()` call when real-time matters.

## ADR-8 Avatars stored in MongoDB

- **Decision:** uploads are checked by magic bytes, re-encoded by sharp to a 256 px WebP (about 10–20 KB) and stored in an `avatars` collection; served with a versioned URL and immutable caching.
- **Why:** no third-party storage account or keys; re-encoding strips anything malicious; the size is trivial.
- **Cost:** not suited to large files; object storage (S3/R2) would be the move for attachments.
