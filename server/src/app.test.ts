import request from "supertest";
import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@nexora/shared";
import { createApp } from "./app";

describe("GET /api/v1/health", () => {
  it("returns ok in the shared response shape", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
