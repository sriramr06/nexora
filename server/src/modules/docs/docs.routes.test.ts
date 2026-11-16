import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { OPERATION_COUNT } from "./openapi";

const app = createApp();

describe("API docs", () => {
  it("serves an OpenAPI 3.1 document built from the shared Zod schemas", async () => {
    const res = await request(app).get("/api/v1/openapi.json").expect(200);
    const doc = res.body;
    expect(doc.openapi).toBe("3.1.0");

    const operations = Object.values(doc.paths as Record<string, object>).flatMap(Object.keys);
    expect(operations).toHaveLength(OPERATION_COUNT);

    // A body schema comes straight from the validator: the register rules are there.
    const register = doc.paths["/auth/register"].post;
    const body = register.requestBody.content["application/json"].schema;
    expect(body.required).toEqual(expect.arrayContaining(["name", "email", "password"]));

    // Tenant routes declare their path parameters and require a bearer token.
    const board = doc.paths["/orgs/{orgId}/projects/{projectId}/board"].get;
    expect(board.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(["orgId", "projectId", "assigneeId", "priority"]),
    );
    expect(board.security).toEqual([{ bearer: [] }]);
  });

  it("serves Swagger UI with a policy that allows only its pinned CDN", async () => {
    const res = await request(app).get("/api/docs").expect(200);
    expect(res.text).toContain("swagger-ui-dist@5.17.14");
    expect(res.headers["content-security-policy"]).toContain("https://cdn.jsdelivr.net");
  });
});
