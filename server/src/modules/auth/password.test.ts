import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a bcrypt hash with the configured cost, never the plain text", async () => {
    const hash = await hashPassword("secret123");

    expect(hash).not.toContain("secret123");
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt format: $2b$<cost>$...
  });

  it("salts every hash, so the same password hashes differently", async () => {
    const [first, second] = await Promise.all([
      hashPassword("secret123"),
      hashPassword("secret123"),
    ]);

    expect(first).not.toBe(second);
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("secret123");

    expect(await verifyPassword("secret123", hash)).toBe(true);
    expect(await verifyPassword("Secret123", hash)).toBe(false);
  });
});
