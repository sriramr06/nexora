import { z } from "zod";

export const API_PREFIX = "/api/v1";

export const healthResponseSchema = z.object({
  data: z.object({
    // "ok" when every dependency is up, "degraded" otherwise (HTTP 503)
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["up", "down"]),
    timestamp: z.iso.datetime(),
    // Git commit of the running build ("dev" locally). CI waits for the merged commit
    // to appear here, so a deploy that fails to start turns the pipeline red.
    version: z.string(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
