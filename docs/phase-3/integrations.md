# Integrations

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.7 — Integrations  
**Version:** 1.0  
**Status:** Draft

## 1. Objective

Define how Nexora integrates with external services (email, Cloudinary) and how activity entries and notifications are produced internally.

## 2. Decisions

| ID | Decision |
|---|---|
| INT-1 | Email is sent with **Nodemailer over SMTP**. Production uses **Gmail SMTP** (`smtp.gmail.com:465`, Google App Password; the sender is the same Gmail address; ~500 emails/day). The provider can be changed through environment variables only. Changed from Brevo on 12 Nov 2026 (Brevo signup required business details). |
| INT-2 | An `EmailService` interface has three implementations: `SmtpEmailService` (production), `ConsoleEmailService` (development — prints emails and links), `FakeEmailService` (tests — records sent emails for assertions). |
| INT-3 | Emails are sent **after** the database transaction commits, never inside it. No background queue. |
| INT-4 | Avatars are uploaded **through the API** to Cloudinary, with size and byte-level type validation and a 256 × 256 WebP transformation. |
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

## 4. Cloudinary (Avatars)

### 4.1 Upload Flow

1. Client sends `multipart/form-data` to `POST /me/avatar`.
2. API accepts at most 2 MB in memory (no disk writes).
3. API checks the file's **magic bytes**: only JPEG, PNG and WebP are accepted, regardless of file name or declared type.
4. API uploads to Cloudinary folder `nexora/<environment>/avatars/` with a new random public ID and the transformation: crop to square (face-aware), 256 × 256, WebP.
5. API saves `{ url, publicId }` on the user. If this fails, the new image is deleted from Cloudinary.
6. API deletes the previous image. If this fails, the error is logged; the orphaned image is harmless.

### 4.2 Delivery

Smaller sizes (e.g. 32 px and 64 px) are produced by Cloudinary URL transformations from the stored image. Users without an avatar display initials (FR-PROF-04).

### 4.3 Removal

`DELETE /me/avatar` clears the field first, then deletes the image from Cloudinary.

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
| `EMAIL_TRANSPORT` | `smtp` / `console` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP credentials (Gmail: host `smtp.gmail.com`, port `465`, App Password) |
| `EMAIL_FROM` | Verified sender, e.g. `Nexora <sender@example.com>` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `CLOUDINARY_FOLDER` | Environment folder, e.g. `nexora/production` |

All secrets are provided through environment variables and never committed (NFR-SEC-10).

**Next step:** Step 3.8 — Deployment and CI.
