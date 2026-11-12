import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    // Frontend base URL, used in email links (verification, reset, invitations).
    // Trailing slashes are removed so links never contain "//".
    APP_URL: z.url().transform((url) => url.replace(/\/+$/, "")),

    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),

    // HS256 signing secret for access tokens: at least 256 bits (AU-5).
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),

    // Email (INT-1, INT-2): "console" prints emails, "smtp" sends them.
    EMAIL_TRANSPORT: z.enum(["console", "smtp", "gmail_api"]).default("console"),
    EMAIL_FROM: z.string().min(1).default("Nexora <no-reply@nexora.local>"),
    // Empty strings (e.g. "SMTP_HOST=" in .env) are treated as not set.
    SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
    SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
    // Gmail API over HTTPS (INT-1): OAuth client + refresh token with the gmail.send scope.
    GMAIL_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    GMAIL_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    GMAIL_REFRESH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.EMAIL_TRANSPORT === "console") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "EMAIL_TRANSPORT must be smtp or gmail_api in production",
      });
    }
    if (env.EMAIL_TRANSPORT === "gmail_api") {
      for (const key of [
        "GMAIL_CLIENT_ID",
        "GMAIL_CLIENT_SECRET",
        "GMAIL_REFRESH_TOKEN",
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required for gmail_api`,
          });
        }
      }
    }
    if (env.EMAIL_TRANSPORT === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required for smtp` });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
