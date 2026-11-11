import mongoose from "mongoose";
import { logger } from "../common/logger";
import { runScript } from "./run-script";

// Models must be imported here so Mongoose knows about them, e.g.:
// import "../modules/users/user.model";

// Creates missing indexes and drops indexes no longer defined in the schemas (DEP-9).
// Runs in the deploy pipeline because autoIndex is disabled in production.
await runScript("db:sync-indexes", async () => {
  const modelNames = mongoose.modelNames();

  if (modelNames.length === 0) {
    logger.info("No models registered yet");
    return;
  }

  for (const name of modelNames) {
    const dropped = await mongoose.model(name).syncIndexes();
    logger.info({ model: name, dropped }, "Indexes synced");
  }
});
