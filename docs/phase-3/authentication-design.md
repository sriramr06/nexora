# Authentication Design

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.4 — Authentication Design  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define how users authenticate, how sessions are maintained and revoked, and how tokens are stored and transported. Authorization (roles and tenancy) is covered by the Roles document (Step 2.2) and the tenancy design.

## 2. Decisions

| ID | Decision |
|---|---|
| AU-1 | Two tokens: a short-lived **access token** (JWT) and a long-lived **refresh token** (opaque random string). |
| AU-2 | Access token lifetime **15 minutes**; held **in memory** by the client and sent as `Authorization: Bearer <token>`. |
| AU-3 | Refresh token held in an **`httpOnly`, `Secure`, `SameSite=Lax` cookie** scoped to `Path=/api/v1/auth`; stored server-side only as a SHA-256 hash. |
| AU-4 | Tokens are never stored in `localStorage` or `sessionStorage`. |
| AU-5 | The JWT carries identity only: `sub` (userId), `iat`, `exp`. Signed with HS256 using a secret of at least 256 bits. |
| AU-6 | Refresh tokens are **rotated** on every use and grouped into **families** (one family per login) for reuse detection. |
| AU-7 | Reuse grace period of **10 seconds** for concurrent refreshes from multiple tabs. |
| AU-8 | Session limits: **7 days of inactivity** and **30 days absolute** per family. |
| AU-9 | Passwords hashed with **bcrypt, cost 12**. |
| AU-10 | Access tokens issued before `users.passwordChangedAt` are rejected. |
| AU-11 | Registration may reveal that an email is already registered (FR-AUTH-02); mitigated by rate limiting. Login and password reset do not reveal it. |
| AU-12 | **Same-site deployment:** the browser reaches the API only through the frontend's domain using a **Vercel rewrite proxy** (`/api/*` → Render). A custom domain may be added later. |

## 3. Token Families

A **family** is the chain of refresh tokens descending from a single login, identified by `familyId`.

```
Laptop login (fam_A):  R1 → R2 → R3     (laptop holds R3)
Phone login  (fam_B):  P1 → P2          (phone holds P2)
```

If a token that was already replaced (e.g. R1) is presented again more than 10 seconds after its replacement, it is treated as stolen and the **whole family** is revoked. Other families (other devices) are unaffected. Each token also carries the family's absolute expiry (`familyExpiresAt`).

## 4. Flows

### 4.1 Registration and Email Verification
1. `POST /auth/register` — validate, hash password, create user (`emailVerified: false`), issue an `email_verification` token, send the email.
2. `POST /auth/verify-email` with the token — verify hash, unused and unexpired; set `emailVerified: true` and `usedAt`.
3. `POST /auth/resend-verification` — invalidates previous unused verification tokens and sends a new one.

Unverified users can log in but cannot register an organization (FR-AUTH-05).

### 4.2 Login
1. `POST /auth/login` with email and password (rate-limited).
2. On success: create a new family, store the refresh token hash, set the cookie, update `lastLoginAt`, return the access token and user profile.
3. On failure: generic "Invalid email or password".

### 4.3 Authenticated Request
1. Verify the JWT signature and expiry.
2. Load the user; reject if `iat` is earlier than `passwordChangedAt`.
3. Continue with tenancy and permission checks (organization status, membership, role, project access).

### 4.4 Refresh
1. The client receives `401 TOKEN_EXPIRED` and calls `POST /auth/refresh`; the browser sends the cookie.
2. The server looks up the token hash:
   - Not found, revoked, past `expiresAt` or past `familyExpiresAt` → 401 and clear the cookie.
   - Replaced **more than** 10 seconds ago → revoke the family, 401, clear the cookie.
   - Replaced **within** 10 seconds → 401 without revocation; the client retries with the current cookie.
   - Valid → set `replacedAt`, issue a new token in the same family (new `expiresAt`, same `familyExpiresAt`), set the cookie, return a new access token.
3. The client retries the original request.

**Client rule:** only one refresh request is in flight per tab; other requests wait for its result.

### 4.5 Page Load
The access token is lost on reload. On startup the client calls `POST /auth/refresh`; success restores the session, failure shows the login page.

### 4.6 Logout
`POST /auth/logout` revokes the current refresh token's family and clears the cookie. The client discards the access token.

### 4.7 Password Reset
1. `POST /auth/forgot-password` — always returns the same response. If the account exists, previous unused reset tokens are invalidated and a 1-hour token is emailed.
2. `POST /auth/reset-password` with token and new password — validate the token, update the password hash, set `passwordChangedAt`, mark the token used, revoke **all** of the user's refresh tokens.

### 4.8 Change Password
`POST /auth/change-password` with current and new password — on success, update the hash and `passwordChangedAt`, revoke all of the user's refresh tokens, and issue a new family for the current session.

### 4.9 Invitation Registration
Registering through a valid invitation creates the user with `emailVerified: true` (the link was delivered to that inbox), creates the membership and pre-selected project memberships in one transaction, and logs the user in (FR-INV-06).

## 5. Deployment Requirements

- The frontend (Vercel) proxies `/api/*` to the backend (Render) via `client/vercel.json` rewrites, so the refresh cookie is first-party and no CORS configuration is required in production.
- Express `trust proxy` is configured so rate limiting uses the real client IP from `X-Forwarded-For`.
- All traffic uses HTTPS; the cookie is `Secure`.
- In local development, the Vite dev server proxies `/api` to the local backend in the same way.

## 6. Security Notes

| Threat | Mitigation |
|---|---|
| Token theft via XSS | Refresh token in `httpOnly` cookie; access token only in memory and short-lived; plain-text rendering of user content |
| Stolen refresh token reuse | Rotation and family revocation (Section 3) |
| CSRF | Same-site deployment; `SameSite=Lax` cookie limited to `/api/v1/auth`; state-changing API calls require the `Authorization` header, which browsers do not attach automatically |
| Brute-force login | Rate limiting per IP and email (NFR-SEC-07); bcrypt cost 12 |
| Session persistence after password change | All refresh tokens revoked; access tokens issued earlier rejected (AU-10) |
| Account enumeration | Generic login and reset responses; registration exposure accepted with rate limiting (AU-11) |

**Next step:** Step 3.5 — API Design.
