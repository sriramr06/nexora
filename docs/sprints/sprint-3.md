# Sprint 3 — Members, Invitations and Profile

**Dates:** 17 – 19 November 2026 (plan v1.1; built 12 Nov)  
**Goal:** teams can be built and managed.

## Decisions (12 Nov 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Invitation project pre-selection (R13) needs projects | Moved **whole feature** (API + picker + add-on-accept) to Sprint 4; every feature ships backend and frontend together |
| Q2 | Avatar storage | **MongoDB**, resized to 256 px WebP (Cloudinary dropped; INT-4, data model §4.12) |

## Backend

- [x] `invitations` model: partial unique pending index (FR-INV-04), computed "expired"
- [x] Invite single + bulk (≤ 20, per-address results, emails 5 at a time), PM limit (R11), Owner email refused (R8)
- [x] List (admins all, PMs own; status filter), resend (5-minute cooldown, token rotation), revoke
- [x] Public: lookup, register through invitation (verified + logged in), accept (email must match); R10 / FR-INV-08 checks
- [x] Members: list, change role, remove, leave; last-admin rule with `adminsVersion` (R1); R12 auto-revoke
- [x] Profile: name; avatar upload (magic bytes, 2 MB, `sharp` 256 px WebP), served with versioned caching; remove
- [x] Cross-tenant harness: all new tenant endpoints

## Client

- [x] Organization tabs (Overview, Members, Invitations, Settings) shown per role via `can()`
- [x] Members page: role change, remove, leave (confirm dialogs); stacked layout on phones
- [x] Invitations page: one form for single or bulk, per-address results, status filter, resend / revoke
- [x] `/invite` page: register, log in to accept, accept, or explain why the link is closed
- [x] Account: profile name and avatar upload / remove; avatars (initials fallback) in header, members, overview
- [x] Browser-checked end to end, light, 360 px

## Stories

- [x] US-12 Invite a member
- [x] US-13 Manage invitations
- [x] US-14 Accept an invitation (new account or existing account)
- [x] US-15 Manage member roles and removal
- [x] US-16 Leave an organization
- [x] US-31 Manage my avatar
- [x] US-32 Update my name
- [x] US-35 Invite several people at once
- [ ] US-34 Invite members to my project — PM invites Team Members ✅; project pre-selection (R13) → Sprint 4
- [ ] R5 / R6 removal cascades → Sprint 6 (need projects and tasks)

## Review (end of sprint)

- **Done / not done:**
- **What slowed me down:**
- **What I will change next sprint:**
