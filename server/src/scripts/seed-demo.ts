import { logger } from "../common/logger";
import { seedDemo } from "./demo-data";
import { runScript } from "./run-script";

// npm run db:seed:demo — after `npm run db:seed` (the Owner). Safe to re-run.
await runScript("db:seed:demo", async () => {
  if (!(await seedDemo())) {
    logger.info("Demo data already exists; nothing to do. Drop the database to start over.");
  }
});
