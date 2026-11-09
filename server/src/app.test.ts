import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { healthResponseSchema } from "@nexora/shared";
import { createApp } from "./app";
import { startTestDb, stopTestDb } from "./test/db";

describe("GET /api/v1/health", () => {
  it("returns 503 degraded when the database is not connected", async () => {
    const res = await request(createApp()).get("/api/v1/health");

    expect(res.status).toBe(503);
    expect(res.body.data).toMatchObject({ status: "degraded", database: "down" });
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  describe("with a database", () => {
    beforeAll(startTestDb);
    afterAll(stopTestDb);

    it("returns 200 ok when the database is connected", async () => {
      const res = await request(createApp()).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: "ok", database: "up" });
      expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
    });
  });
});
