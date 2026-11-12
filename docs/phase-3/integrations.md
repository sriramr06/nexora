# Integrations

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.7 — Integrations  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define how Nexora integrates with external services (email) and how activity entries and notifications are produced internally.

## 2. Decisions

| ID | Decision |
|---|---|
| INT-1 | Production email is sent through the **Gmail REST API over HTTPS** (`EMAIL_TRANSPORT=gmail_api`) from the project Gmail account, using an OAuth refresh token with the `gmail.send` scope (~500 emails/day). Reason: Render free instances block outbound SMTP, and Brevo signup required business details (decided 12 Nov 2026). Nodemailer SMTP remains available (`EMAIL_TRANSPORT=smtp`) for hosts that allow it. |
| INT-2 | An `EmailService` interface has four implementations: `GmailApiEmailService` (production), `SmtpEmailService` (alternative), `ConsoleEmailService` (development — prints emails and links), `FakeEmailService` (tests — records sent emails for assertions). All network transports time out after 10 seconds. |
| INT-3 | Emails are sent **after** the database transaction commits, never inside it. No background queue. |
| INT-4 | Avatars are uploaded **through the API** and stored in MongoDB (`avatars` collection), with size and byte-level type validation and a 256 × 256 WebP transformation (changed from Cloudinary on 12 Nov 2026). |
| INT-5 | Activity entries and notifications are written by **explicit calls inside the same transaction** as the change, not by post-commit events. |
| INT-6 | No background jobs: expiry is computed, cleanup uses TTL indexes, and emails are sent inline. |

## 3. Email

### 3.1 Emails

| Email | Trigger | Content |
|---|---|---|
| Email verification | Registration, resend | Link valid 24 hours |
| Password reset | Forgot password | Link valid 1 hour |
| Invitation | Invite, bulk invite, resend | Organization, inviter, role, link valid 7 days |
| Organization approved | Application Owner approval | Link to the organization |
| Organization rejected | Application Owner rejection | Reason; link to edit and resubmit |

Templates are code functions returning an HTML and a plain-text body. Links point to the frontend (e.g. `/invite?token=…`), built from the `APP_URL` environment variable.

### 3.2 Failure Handling

| Flow | On send failure |
|---|---|
| Invitation (single) | Invitation is kept; API returns success with `emailSent: false`; the UI offers Resend |
| Bulk invitation | Per-address result `email_failed`; others unaffected |
| Verification | Account is kept; user can use "Resend verification email" |
| Password reset | Generic response unchanged; failure logged only |
| Organization approved / rejected | Status change is kept; failure logged; the admin sees the status on next login |

Bulk invitation emails are sent in parallel with a concurrency limit of 5.

### 3.3 Deliverability

Without a custom domain, emails are sent from a verified personal sender address and may be classified as spam. A custom domain with SPF / DKIM records can be added later without code changes.

## 4. Avatars (stored in MongoDB)

**Changed 12 Nov 2026:** avatars are stored in MongoDB instead of Cloudinary, so the project needs no extra external account. The upload rules are unchanged.

### 4.1 Upload Flow

1. Client sends `multipart/form-data` to `POST /me/avatar`.
2. API accepts at most 2 MB in memory (no disk writes).
3. API checks the file's **magic bytes**: only JPEG, PNG and WebP are accepted, regardless of file name or declared type.
4. API crops to a centred square, resizes to 256 × 256 and re-encodes as WebP with `sharp` (re-encoding also strips metadata such as GPS).
5. The image is upserted into the `avatars` collection (one document per user) and the user's `avatar` is set to `{ url, publicId }`, where `publicId` is a new random version ID.

### 4.2 Delivery

`GET /api/v1/users/:userId/avatar?v=<publicId>` serves the WebP with long-lived caching; the version in the URL changes on every upload, so caches never show an old image. Avatars are public, like profile pictures on most products (needed because `<img>` cannot send the access token). Users without an avatar display initials (FR-PROF-04).

### 4.3 Removal

`DELETE /me/avatar` clears the user's `avatar` and deletes the stored image (FR-PROF-03).

## 5. Activity and Notifications

### 5.1 Pattern

```ts
await withTransaction(async (session) => {
  const task = await taskRepository.updateStatus(..., session);   // 1. change
  await activityService.record({ action, changes, snapshot }, session); // 2. history
  await notificationService.notify(event, recipients, session);   // 3. notifications
});
// after commit: send emails, if any
```

### 5.2 Notification Rules (Central)

`notificationService.notify()` is the only way notifications are created. It:
- removes the actor from recipients (FR-NOT-02);
- removes duplicate recipients;
- applies the most specific type when one action matches several events;
- stores `type`, link targets and the `data` snapshot only (no rendered text).

### 5.3 Why Not Events

Post-commit events decouple code but can lose activity or notifications if a listener fails after the change is committed, violating FR-ACT-02 and NFR-REL-01. Events may be introduced later for non-critical features such as real-time updates.

## 6. Configuration

| Variable | Purpose |
|---|---|
| `APP_URL` | Frontend base URL used in email links |
| `EMAIL_TRANSPORT` | `gmail_api` / `smtp` / `console` |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Gmail API OAuth client and refresh token (scope `https://www.googleapis.com/auth/gmail.send`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP credentials (Gmail: host `smtp.gmail.com`, port `465`, App Password) |
| `EMAIL_FROM` | Verified sender, e.g. `Nexora <sender@example.com>` |

All secrets are provided through environment variables and never committed (NFR-SEC-10).

**Next step:** Step 3.8 — Deployment and CI.
