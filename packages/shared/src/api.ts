import { z } from "zod";

export const API_PREFIX = "/api/v1";

export const healthResponseSchema = z.object({
  data: z.object({
    status: z.literal("ok"),
    timestamp: z.string(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
