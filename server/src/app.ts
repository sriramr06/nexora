import express from "express";
import { API_PREFIX, type HealthResponse } from "@nexora/shared";
import { httpLogger } from "./common/middleware/http-logger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { notFound } from "./common/middleware/not-found";
import { errorHandler } from "./common/middleware/error-handler";
import { isDbConnected } from "./common/db/connection";

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
    const databaseUp = isDbConnected();
    const body: HealthResponse = {
      data: {
        status: databaseUp ? "ok" : "degraded",
        database: databaseUp ? "up" : "down",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(databaseUp ? 200 : 503).json(body);
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
