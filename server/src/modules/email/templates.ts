import { env } from "../../config/env";
import type { EmailMessage } from "./email.service";

// What a template produces; the caller adds "to".
export type EmailContent = Omit<EmailMessage, "to">;

// User-supplied text placed into HTML must be escaped, otherwise a name like
// "<img src=x onerror=...>" would become real HTML inside the email.
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// Builds a frontend link, e.g. appLink("/verify-email", token)
// → https://nexora-six-rouge.vercel.app/verify-email?token=...
export const appLink = (path: string, token: string): string =>
  `${env.APP_URL}${path}?token=${encodeURIComponent(token)}`;

// Shared HTML wrapper so every email looks the same.
const layout = (body: string): string => `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
    <div style="max-width: 480px; margin: 0 auto; padding: 24px;">
      ${body}
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Nexora</p>
    </div>
  </body>
</html>`;

const button = (link: string, label: string): string =>
  `<p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 10px 16px; background: #0f6b62; color: #ffffff; text-decoration: none; border-radius: 6px;">${label}</a></p>
<p style="font-size: 12px; color: #6b7280;">Or paste this link into your browser:<br>${escapeHtml(link)}</p>`;

export const verificationEmail = (name: string, link: string): EmailContent => ({
  subject: "Verify your Nexora email",
  text: [
    `Hi ${name},`,
    "",
    "Please verify your email address by opening this link:",
    link,
    "",
    "This link expires in 24 hours.",
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>Please verify your email address.</p>
      ${button(link, "Verify email")}
      <p>This link expires in 24 hours.</p>`),
});

export const passwordResetEmail = (name: string, link: string): EmailContent => ({
  subject: "Reset your Nexora password",
  text: [
    `Hi ${name},`,
    "",
    "Reset your password by opening this link:",
    link,
    "",
    "This link expires in 1 hour.",
    "If you didn't request this, you can ignore this email.",
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received a request to reset your password.</p>
      ${button(link, "Reset password")}
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can ignore this email.</p>`),
});

// Plain frontend link without a token, e.g. appUrl("/o/123").
export const appUrl = (path: string): string => `${env.APP_URL}${path}`;

// ---------- organization lifecycle (FR-ORG-08, FR-ORG-10) ----------

export const organizationApprovedEmail = (
  name: string,
  orgName: string,
  link: string,
): EmailContent => ({
  subject: `${orgName} is approved on Nexora`,
  text: [
    `Hi ${name},`,
    "",
    `Good news: ${orgName} has been approved. You can now create projects and invite your team:`,
    link,
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p>Good news: <strong>${escapeHtml(orgName)}</strong> has been approved. You can now create projects and invite your team.</p>
      ${button(link, "Open Nexora")}`),
});

export const organizationRejectedEmail = (
  name: string,
  orgName: string,
  reason: string,
  link: string,
): EmailContent => ({
  subject: `${orgName} needs changes before approval`,
  text: [
    `Hi ${name},`,
    "",
    `${orgName} was not approved. Reason:`,
    reason,
    "",
    "You can update the details and resubmit:",
    link,
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p><strong>${escapeHtml(orgName)}</strong> was not approved. Reason:</p>
      <blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0;">${escapeHtml(reason)}</blockquote>
      <p>You can update the details and resubmit.</p>
      ${button(link, "Review and resubmit")}`),
});

export const organizationSuspendedEmail = (
  name: string,
  orgName: string,
  reason: string,
): EmailContent => ({
  subject: `${orgName} has been suspended`,
  text: [
    `Hi ${name},`,
    "",
    `${orgName} has been suspended on Nexora, so its members cannot access projects for now. Reason:`,
    reason,
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p><strong>${escapeHtml(orgName)}</strong> has been suspended on Nexora, so its members cannot access projects for now. Reason:</p>
      <blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #e2e8f0;">${escapeHtml(reason)}</blockquote>`),
});

export const organizationReactivatedEmail = (
  name: string,
  orgName: string,
  link: string,
): EmailContent => ({
  subject: `${orgName} is active again`,
  text: [
    `Hi ${name},`,
    "",
    `${orgName} has been reactivated. Your team has access again:`,
    link,
  ].join("\n"),
  html: layout(`
      <p>Hi ${escapeHtml(name)},</p>
      <p><strong>${escapeHtml(orgName)}</strong> has been reactivated. Your team has access again.</p>
      ${button(link, "Open Nexora")}`),
});

// ---------- invitations (FR-INV-03) ----------

export const invitationEmail = (
  orgName: string,
  inviterName: string,
  roleLabel: string,
  link: string,
): EmailContent => ({
  subject: `${inviterName} invited you to ${orgName} on Nexora`,
  text: [
    "Hi,",
    "",
    `${inviterName} invited you to join ${orgName} on Nexora as ${roleLabel}.`,
    "Accept the invitation:",
    link,
    "",
    "This link expires in 7 days.",
  ].join("\n"),
  html: layout(`
      <p>Hi,</p>
      <p><strong>${escapeHtml(inviterName)}</strong> invited you to join <strong>${escapeHtml(orgName)}</strong> on Nexora as ${escapeHtml(roleLabel)}.</p>
      ${button(link, "Accept invitation")}
      <p>This link expires in 7 days.</p>`),
});
