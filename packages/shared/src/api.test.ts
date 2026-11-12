import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./api";

const timestamp = new Date().toISOString();

describe("healthResponseSchema", () => {
  it("accepts a healthy response", () => {
    const result = healthResponseSchema.safeParse({
      data: { status: "ok", database: "up", timestamp, version: "abc123" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a degraded response", () => {
    const result = healthResponseSchema.safeParse({
      data: { status: "degraded", database: "down", timestamp, version: "dev" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = healthResponseSchema.safeParse({
      data: { status: "broken", database: "up", timestamp, version: "dev" },
    });
    expect(result.success).toBe(false);
  });
});
