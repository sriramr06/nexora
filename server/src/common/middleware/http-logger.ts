import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../logger";

export const httpLogger = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const id = randomUUID();

    res.setHeader("X-Request-Id", id);
    return id;
  },

  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) {
      return "error";
    }

    if (res.statusCode >= 400) {
      return "warn";
    }

    return "info";
  },
});
