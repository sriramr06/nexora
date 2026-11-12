import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sendCreated, sendData, sendList, sendNoContent } from "./respond";

// A tiny app with one route per helper, so we test the real HTTP output.
const app = express();
app.get("/data", (_req, res) => sendData(res, { id: "1" }));
app.get("/data-503", (_req, res) => sendData(res, { ok: false }, 503));
app.post("/created", (_req, res) => sendCreated(res, { id: "2" }));
app.get("/list", (_req, res) =>
  sendList(res, [{ id: "a" }], { page: 1, limit: 20, total: 1, totalPages: 1 }),
);
app.delete("/gone", (_req, res) => sendNoContent(res));

describe("response helpers", () => {
  it("sendData wraps the payload in { data } with 200 by default", async () => {
    const res = await request(app).get("/data");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { id: "1" } });
  });

  it("sendData accepts a custom status", async () => {
    const res = await request(app).get("/data-503");

    expect(res.status).toBe(503);
  });

  it("sendCreated responds 201", async () => {
    const res = await request(app).post("/created");

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: "2" } });
  });

  it("sendList returns { data, pagination }", async () => {
    const res = await request(app).get("/list");

    expect(res.body).toEqual({
      data: [{ id: "a" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("sendNoContent responds 204 with an empty body", async () => {
    const res = await request(app).delete("/gone");

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });
});
