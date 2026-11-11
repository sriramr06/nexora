import pino from "pino";
import { env, isTest } from "../config/env";

const isDevelopment = env.NODE_ENV === "development";

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.token",
    ],
    censor: "[REDACTED]",
  },

  // Pretty output only in development
  transport: isDevelopment ? { target: "pino-pretty" } : undefined,
});
