import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env";
import { signAccessToken, verifyAccessToken } from "./access-token";

const userId = "665f1c2e9b1d4a0012345678";

describe("access tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips: a signed token verifies back to the same user", () => {
    const result = verifyAccessToken(signAccessToken(userId));

    expect(result.userId).toBe(userId);
    expect(result.issuedAt).toBeInstanceOf(Date);
  });

  it("rejects an expired token with TOKEN_EXPIRED", () => {
    // Fake timers let us "travel" past the 15-minute lifetime instantly.
    vi.useFakeTimers();
    const token = signAccessToken(userId);
    vi.advanceTimersByTime(16 * 60 * 1000);

    expect(() => verifyAccessToken(token)).toThrow(
      expect.objectContaining({ status: 401, code: "TOKEN_EXPIRED" }),
    );
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ sub: userId }, "x".repeat(32), { algorithm: "HS256" });

    expect(() => verifyAccessToken(forged)).toThrow(
      expect.objectContaining({ status: 401, code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects a tampered token", () => {
    const [header, , signature] = signAccessToken(userId).split(".");
    const fakePayload = Buffer.from(JSON.stringify({ sub: "someone-else" })).toString("base64url");

    expect(() => verifyAccessToken(`${header}.${fakePayload}.${signature}`)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects the 'none' algorithm (unsigned token)", () => {
    const unsigned = jwt.sign({ sub: userId }, "", { algorithm: "none" });

    expect(() => verifyAccessToken(unsigned)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects a validly signed token without a string sub", () => {
    const noSub = jwt.sign({ role: "admin" }, env.JWT_ACCESS_SECRET, { algorithm: "HS256" });

    expect(() => verifyAccessToken(noSub)).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });

  it("rejects garbage", () => {
    expect(() => verifyAccessToken("not-a-jwt")).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });
});
