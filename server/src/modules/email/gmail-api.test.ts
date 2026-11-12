import { describe, expect, it, vi } from "vitest";
import { buildMime, GmailApiEmailService } from "./gmail-api";

const config = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  from: "Nexora <nexora.app@gmail.com>",
};

const message = {
  to: "priya@acme.com",
  subject: "Verify your Nexora email",
  text: "Hi Priya\nhttps://nexora.test/verify-email?token=abc",
  html: "<p>Hi Priya</p>",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const decodeRaw = (init: RequestInit) => {
  const { raw } = JSON.parse(String(init.body)) as { raw: string };
  return Buffer.from(raw, "base64url").toString("utf8");
};

const decodePart = (mime: string, type: string) => {
  const part = mime.split(/--nexora-[^\r\n]+/).find((p) => p.includes(`Content-Type: ${type}`))!;
  const body = part.split("\r\n\r\n")[1]!.replace(/\r\n/g, "");
  return Buffer.from(body, "base64").toString("utf8");
};

describe("buildMime", () => {
  it("builds a multipart message with text and HTML parts", () => {
    const mime = buildMime(config.from, message);

    expect(mime).toContain("From: Nexora <nexora.app@gmail.com>");
    expect(mime).toContain("To: priya@acme.com");
    expect(mime).toContain("Subject: Verify your Nexora email");
    expect(decodePart(mime, "text/plain")).toBe(message.text);
    expect(decodePart(mime, "text/html")).toBe(message.html);
  });

  it("encodes non-ASCII subjects and strips header line breaks (no header injection)", () => {
    const mime = buildMime(config.from, {
      ...message,
      to: "priya@acme.com\r\nBcc: attacker@evil.test",
      subject: "Café — approved",
    });

    expect(mime).not.toMatch(/^Bcc:/m);
    expect(mime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
  });
});

describe("GmailApiEmailService", () => {
  it("refreshes an access token, then sends the raw message", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { access_token: "access-1", expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, { id: "msg-1" }));

    await new GmailApiEmailService(config, fetchMock).send(message);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(String(tokenUrl)).toBe("https://oauth2.googleapis.com/token");
    expect(String(tokenInit!.body)).toContain("grant_type=refresh_token");

    const [sendUrl, sendInit] = fetchMock.mock.calls[1]!;
    expect(String(sendUrl)).toContain("/gmail/v1/users/me/messages/send");
    expect(new Headers(sendInit!.headers).get("Authorization")).toBe("Bearer access-1");
    expect(decodeRaw(sendInit!)).toContain("To: priya@acme.com");
  });

  it("reuses the access token until it is about to expire", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { access_token: "access-1", expires_in: 3600 }))
      .mockResolvedValue(json(200, { id: "msg" }));
    const service = new GmailApiEmailService(config, fetchMock);

    await service.send(message);
    await service.send(message);

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
  });

  it("throws on a rejected refresh token or a failed send, so callers can log it", async () => {
    const badToken = vi.fn<typeof fetch>().mockResolvedValue(json(400, { error: "invalid_grant" }));
    await expect(new GmailApiEmailService(config, badToken).send(message)).rejects.toThrow(
      /token refresh failed \(400\)/,
    );

    const badSend = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { access_token: "a", expires_in: 3600 }))
      .mockResolvedValueOnce(json(403, { error: "forbidden" }));
    await expect(new GmailApiEmailService(config, badSend).send(message)).rejects.toThrow(
      /send failed \(403\)/,
    );
  });

  it("passes a timeout signal so a stalled request cannot hang registration", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { access_token: "a", expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, {}));

    await new GmailApiEmailService(config, fetchMock).send(message);

    for (const [, init] of fetchMock.mock.calls) expect(init!.signal).toBeInstanceOf(AbortSignal);
  });
});
