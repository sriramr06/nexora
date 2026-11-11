import { logger } from "../common/logger";
import { runScript } from "./run-script";

// Creates required data (Application Owner) and optional demo data (NFR-OPS-05).
// Seeders are added as their models are built (users in Sprint 1, organizations in Sprint 2, ...).
await runScript("db:seed", async () => {
  logger.info("No seeders yet");
});
