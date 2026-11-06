import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./api";

describe("healthResponseSchema", () => {
  it("accepts a valid health response", () => {
    const result = healthResponseSchema.safeParse({
      data: { status: "ok", timestamp: new Date().toISOString() },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = healthResponseSchema.safeParse({
      data: { status: "down", timestamp: new Date().toISOString() },
    });
    expect(result.success).toBe(false);
  });
});
