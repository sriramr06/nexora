import { createApp } from "./app";
import { connectDb, disconnectDb } from "./common/db/connection";
import { logger } from "./common/logger";
import { env } from "./config/env";

const SHUTDOWN_TIMEOUT_MS = 10_000;

// 1. Connect to the database first; never accept requests without it.
try {
  await connectDb();
} catch (err) {
  logger.fatal({ err }, "Could not connect to MongoDB");
  process.exit(1);
}

// 2. Start the HTTP server.
const server = createApp().listen(env.PORT, () => {
  logger.info(`Nexora API listening on http://localhost:${env.PORT}`);
});

// 3. Graceful shutdown: Ctrl+C locally (SIGINT), Render stopping the service (SIGTERM).
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  // Safety net: force exit if open connections keep the process alive too long.
  setTimeout(() => {
    logger.error("Shutdown timed out; forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  // Stop accepting new requests and wait for in-flight ones to finish.
  server.close(async (err) => {
    if (err) logger.error({ err }, "Error while closing HTTP server");

    try {
      await disconnectDb();
      process.exit(err ? 1 : 0);
    } catch (dbErr) {
      logger.error({ err: dbErr }, "Error while disconnecting from MongoDB");
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
