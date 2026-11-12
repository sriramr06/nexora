import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../errors/app-error";

const MINUTE = 60 * 1000;

// Hand 429s to the central error handler so they use the standard error format.
const rateLimitHandler = (_req: unknown, _res: unknown, next: (err: unknown) => void): void => {
  next(AppError.rateLimited("Too many attempts. Please try again later."));
};

// The limiter runs before validation, so read the email defensively.
const emailKey = (body: unknown): string => {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const common = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
} as const;

// API design §9. A factory, so every createApp() (e.g. each test) gets fresh counters.
// In-memory store: fine for one Render instance; a shared store is needed to scale out.
// Public invitation endpoints (API design §9): 20 per 15 minutes per IP.
export const createInvitationRateLimiter = () =>
  rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 20 });

export const createAuthRateLimiters = () => ({
  login: rateLimit({
    ...common,
    windowMs: 15 * MINUTE,
    limit: 10,
    // ipKeyGenerator groups IPv6 addresses by subnet so one user cannot rotate addresses.
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "unknown")}:${emailKey(req.body)}`,
  }),
  register: rateLimit({ ...common, windowMs: 60 * MINUTE, limit: 5 }),
  forgotPassword: rateLimit({ ...common, windowMs: 60 * MINUTE, limit: 5 }),
  resendVerification: rateLimit({ ...common, windowMs: 60 * MINUTE, limit: 5 }),
});
