import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailService } from "./email.service";

// INT-1 (12 Nov 2026): production sends through the Gmail REST API over HTTPS (port 443),
// because Render's free instances block outbound SMTP (25 / 465 / 587).
// Auth: an OAuth refresh token for the sending Gmail account (scope gmail.send).

export interface GmailApiConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  from: string; // must be the Gmail account (Gmail rewrites any other sender)
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GMAIL_HTTP_TIMEOUT_MS = 10_000;

// Header values come from our templates and validated emails, but strip line breaks
// anyway so nothing can inject extra headers.
const headerValue = (value: string) => value.replace(/[\r\n]+/g, " ");

// RFC 2047 encoding for non-ASCII header text (e.g. names with accents).
const encodeHeader = (value: string) =>
  /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

const base64Lines = (text: string) =>
  (
    Buffer.from(text, "utf8")
      .toString("base64")
      .match(/.{1,76}/g) ?? []
  ).join("\r\n");

// A multipart/alternative message: plain text for simple clients, HTML for the rest.
export const buildMime = (from: string, message: EmailMessage): string => {
  const boundary = `nexora-${randomUUID()}`;
  return [
    `From: ${headerValue(from)}`,
    `To: ${headerValue(message.to)}`,
    `Subject: ${encodeHeader(headerValue(message.subject))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(message.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(message.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
};

export class GmailApiEmailService implements EmailService {
  private token: { value: string; expiresAt: number } | undefined;

  constructor(
    private readonly config: GmailApiConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  // Access tokens last about an hour; reuse one until a minute before it expires.
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) return this.token.value;

    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(GMAIL_HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Gmail token refresh failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async send(message: EmailMessage): Promise<void> {
    const raw = Buffer.from(buildMime(this.config.from, message), "utf8").toString("base64url");
    const res = await this.fetchImpl(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(GMAIL_HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      // A revoked or expired refresh token surfaces here; the token is retried next time.
      if (res.status === 401) this.token = undefined;
      throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
    }
  }
}
