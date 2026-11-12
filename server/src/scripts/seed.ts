import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "@nexora/shared";
import { logger } from "../common/logger";
import { runScript } from "./run-script";
import { seedOwner } from "./seed-owner";

// Creates required data (Application Owner) and optional demo data (NFR-OPS-05).
// The Owner's credentials come from the environment, never from code or the API (FR-PLAT-01):
//   OWNER_EMAIL=owner@nexora.app OWNER_NAME="Nexora Owner" OWNER_PASSWORD=... npm run db:seed
const ownerEnv = z.object({
  OWNER_EMAIL: emailSchema,
  OWNER_NAME: nameSchema.default("Nexora Owner"),
  OWNER_PASSWORD: passwordSchema,
});

await runScript("db:seed", async () => {
  const parsed = ownerEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Set OWNER_EMAIL and OWNER_PASSWORD to seed the Application Owner: ${z.prettifyError(parsed.error)}`,
    );
  }

  const result = await seedOwner({
    email: parsed.data.OWNER_EMAIL,
    name: parsed.data.OWNER_NAME,
    password: parsed.data.OWNER_PASSWORD,
  });
  logger.info({ email: parsed.data.OWNER_EMAIL, result }, "Application Owner seeded");
});
