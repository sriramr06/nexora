import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("returns a URL-safe string of 43 characters (32 random bytes)", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns a different value each time", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("is deterministic and 64 hex characters long", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not contain the original token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });
});
