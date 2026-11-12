import { afterEach, describe, expect, it } from "vitest";
import { FakeEmailService } from "../../test/fake-email";
import { ConsoleEmailService, getEmailService, setEmailService } from "./email.service";

const message = {
  to: "priya@acme.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi http://localhost:5173/verify-email?token=abc%2B1",
};

describe("email service", () => {
  const original = getEmailService();
  afterEach(() => setEmailService(original));

  it("uses the console transport when EMAIL_TRANSPORT is not smtp", () => {
    expect(original).toBeInstanceOf(ConsoleEmailService);
  });

  it("can be swapped for a fake, which records sent emails", async () => {
    const fake = new FakeEmailService();
    setEmailService(fake);

    await getEmailService().send(message);

    expect(fake.sent).toEqual([message]);
    expect(fake.lastToken()).toBe("abc+1");
  });

  it("fake can simulate a failure", async () => {
    const fake = new FakeEmailService();
    fake.shouldFail = true;

    await expect(fake.send(message)).rejects.toThrow("Simulated email failure");
  });
});

describe("SMTP timeouts", () => {
  it("fails fast instead of hanging when the SMTP server is unreachable", async () => {
    const { SMTP_TIMEOUTS } = await import("./email.service");
    expect(SMTP_TIMEOUTS.connectionTimeout).toBeLessThanOrEqual(10_000);
    expect(SMTP_TIMEOUTS.greetingTimeout).toBeLessThanOrEqual(10_000);
    expect(SMTP_TIMEOUTS.socketTimeout).toBeLessThanOrEqual(30_000);
  });
});
