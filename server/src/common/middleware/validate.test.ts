import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorHandler } from "./error-handler";
import { httpLogger } from "./http-logger";
import { validate } from "./validate";

// Test app: three routes that use validate() and echo back what the handler received.
function createTestApp() {
  const app = express();
  app.use(httpLogger);
  app.use(express.json());

  app.post(
    "/projects",
    validate({ body: z.object({ name: z.string().trim().min(2) }) }),
    (req, res) => {
      res.json({ body: req.body });
    },
  );

  app.get(
    "/tasks",
    validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1) }) }),
    (_req, res) => {
      res.json({ query: res.locals.query });
    },
  );

  app.get(
    "/projects/:projectId",
    validate({ params: z.object({ projectId: z.string().regex(/^[a-f0-9]{24}$/) }) }),
    (req, res) => {
      res.json({ params: req.params });
    },
  );

  app.use(errorHandler);
  return app;
}

describe("validate middleware", () => {
  describe("body", () => {
    it("rejects an invalid body with 400 and field details", async () => {
      const res = await request(createTestApp()).post("/projects").send({ name: "A" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual([{ field: "name", message: expect.any(String) }]);
    });

    it("passes the parsed body to the handler", async () => {
      const res = await request(createTestApp()).post("/projects").send({ name: "  Portal  " });

      expect(res.status).toBe(200);
      expect(res.body.body).toEqual({ name: "Portal" }); // trimmed by the schema
    });

    it("strips fields that are not in the schema", async () => {
      const res = await request(createTestApp())
        .post("/projects")
        .send({ name: "Portal", organizationId: "someone-elses-org" });

      expect(res.status).toBe(200);
      expect(res.body.body).toEqual({ name: "Portal" });
    });
  });

  describe("query", () => {
    it("applies defaults and type conversion", async () => {
      const res = await request(createTestApp()).get("/tasks");

      expect(res.status).toBe(200);
      expect(res.body.query).toEqual({ page: 1 });
    });

    it("converts query strings to numbers", async () => {
      const res = await request(createTestApp()).get("/tasks?page=3");

      expect(res.body.query).toEqual({ page: 3 }); // number, not "3"
    });

    it("rejects an invalid query value", async () => {
      const res = await request(createTestApp()).get("/tasks?page=0");

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe("page");
    });
  });

  describe("params", () => {
    it("rejects a malformed id", async () => {
      const res = await request(createTestApp()).get("/projects/not-an-id");

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe("projectId");
    });

    it("accepts a valid id", async () => {
      const id = "64f1a2b3c4d5e6f7a8b9c0d1";
      const res = await request(createTestApp()).get(`/projects/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.params).toEqual({ projectId: id });
    });
  });
});
