import express from "express";
import { API_PREFIX, type HealthResponse } from "@nexora/shared";
import { httpLogger } from "./common/middleware/http-logger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { notFound } from "./common/middleware/not-found";
import { errorHandler } from "./common/middleware/error-handler";
import { isDbConnected } from "./common/db/connection";
import { sendData } from "./common/http/respond";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createOrganizationRouter } from "./modules/organizations/organization.routes";
import { createMemberRouter } from "./modules/members/member.routes";
import {
  createPublicInvitationRouter,
  createTenantInvitationRouter,
} from "./modules/invitations/invitation.routes";
import { createMeRouter, createUserRouter } from "./modules/users/me.routes";
import { createProjectRouter } from "./modules/projects/project.routes";
import { createTaskRouter } from "./modules/tasks/task.routes";
import { createPlatformRouter } from "./modules/platform/platform.routes";

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
    const health: HealthResponse["data"] = {
      status: databaseUp ? "ok" : "degraded",
      database: databaseUp ? "up" : "down",
      timestamp: new Date().toISOString(),
      // Render sets RENDER_GIT_COMMIT to the deployed commit.
      version: process.env.RENDER_GIT_COMMIT ?? "dev",
    };
    sendData(res, health, databaseUp ? 200 : 503);
  });

  app.use(`${API_PREFIX}/auth`, createAuthRouter());
  app.use(`${API_PREFIX}/me`, createMeRouter());
  app.use(`${API_PREFIX}/users`, createUserRouter());
  app.use(`${API_PREFIX}/invitations`, createPublicInvitationRouter());
  app.use(`${API_PREFIX}/orgs`, createOrganizationRouter());
  app.use(`${API_PREFIX}/orgs/:orgId`, createMemberRouter());
  app.use(`${API_PREFIX}/orgs/:orgId/invitations`, createTenantInvitationRouter());
  app.use(`${API_PREFIX}/orgs/:orgId/projects`, createProjectRouter());
  app.use(`${API_PREFIX}/orgs/:orgId`, createTaskRouter());
  app.use(`${API_PREFIX}/platform`, createPlatformRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
