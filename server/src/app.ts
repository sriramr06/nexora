import express from "express";
import { API_PREFIX, type HealthResponse } from "@nexora/shared";

// Creates the Express application without starting a server,
// so tests can use it directly with Supertest.
export function createApp() {
  const app = express();

  app.use(express.json());

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    const body: HealthResponse = {
      data: { status: "ok", timestamp: new Date().toISOString() },
    };
    res.json(body);
  });

  return app;
}
