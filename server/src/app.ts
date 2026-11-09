import express from "express";
import { API_PREFIX, type HealthResponse } from "@nexora/shared";
import { httpLogger } from "./common/middleware/http-logger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { notFound } from "./common/middleware/not-found";
import { errorHandler } from "./common/middleware/error-handler";

// Creates the Express application without starting a server,
// so tests can use it directly with Supertest.
export function createApp() {
  const app = express();

  app.use(httpLogger);
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    const body: HealthResponse = {
      data: { status: "ok", timestamp: new Date().toISOString() },
    };
    res.json(body);
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
