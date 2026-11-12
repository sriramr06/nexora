import type { EmailMessage, EmailService } from "../modules/email/email.service";

// Test double (INT-2): records emails instead of sending them,
// so tests can assert on them and pull tokens out of links.
export class FakeEmailService implements EmailService {
  sent: EmailMessage[] = [];
  shouldFail = false; // set true to simulate an SMTP outage

  async send(message: EmailMessage): Promise<void> {
    if (this.shouldFail) throw new Error("Simulated email failure");
    this.sent.push(message);
  }

  last(): EmailMessage | undefined {
    return this.sent.at(-1);
  }

  // Extracts ?token=... from the last email's text body.
  lastToken(): string | undefined {
    const match = this.last()?.text.match(/[?&]token=([^\s&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  clear(): void {
    this.sent = [];
    this.shouldFail = false;
  }
}
