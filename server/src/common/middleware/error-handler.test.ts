import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { AppError } from "../errors/app-error";
import { errorHandler } from "./error-handler";
import { httpLogger } from "./http-logger";
import { notFound } from "./not-found";

// A minimal app with routes that fail in different ways,
// wired with the same middleware order as createApp().
function createTestApp() {
  const app = express();
  app.use(httpLogger);
  app.use(express.json({ limit: "100kb" }));

  app.get("/boom", () => {
    throw new Error("database password is hunter2");
  });
  app.get("/forbidden", () => {
    throw AppError.forbidden();
  });
  app.post("/validate", (req) => {
    z.object({ title: z.string().min(1) }).parse(req.body);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe("error handling", () => {
  it("returns 404 NOT_FOUND for unknown routes", async () => {
    const res = await request(createApp()).get("/api/v1/nope");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("returns a generic 500 without leaking internals", async () => {
    const res = await request(createTestApp()).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(res.body.error.stack).toBeUndefined();
  });

  it("uses the status and code of an AppError", async () => {
    const res = await request(createTestApp()).get("/forbidden");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 VALIDATION_ERROR with field details for Zod errors", async () => {
    const res = await request(createTestApp()).post("/validate").send({ title: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("title");
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON", async () => {
    const res = await request(createApp())
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 413 for bodies over the size limit", async () => {
    const res = await request(createApp())
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ text: "x".repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
