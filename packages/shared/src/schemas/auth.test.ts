import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
} from "./auth";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Priya@Acme.COM ")).toBe("priya@acme.com");
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it.each([
    ["too short", "abc123"],
    ["no number", "abcdefgh"],
    ["no letter", "12345678"],
    ["over 72 chars (bcrypt limit)", `a1${"x".repeat(71)}`],
  ])("rejects a password that is %s", (_case, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it("accepts 8+ chars with a letter and a number", () => {
    expect(passwordSchema.safeParse("secret123").success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("accepts valid input and normalises it", () => {
    const result = registerSchema.parse({
      name: "  Priya ",
      email: "PRIYA@acme.com",
      password: "secret123",
    });

    expect(result).toEqual({ name: "Priya", email: "priya@acme.com", password: "secret123" });
  });

  it("reports each invalid field", () => {
    const result = registerSchema.safeParse({ name: "P", email: "bad", password: "short" });

    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });
});

describe("loginSchema", () => {
  it("does not enforce password strength (old passwords must still log in)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("enforces strength on the new password only", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "secret123" }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "weak" }).success,
    ).toBe(false);
  });
});
