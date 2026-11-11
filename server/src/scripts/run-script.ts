import { connectDb, disconnectDb } from "../common/db/connection";
import { logger } from "../common/logger";

// Shared wrapper for command-line scripts: connect → run → disconnect → exit with a status code.
export async function runScript(name: string, task: () => Promise<void>) {
  logger.info(`${name}: starting`);

  try {
    await connectDb();
    await task();
    logger.info(`${name}: finished`);
    await disconnectDb();
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, `${name}: failed`);
    await disconnectDb().catch(() => undefined); // best effort; we are exiting anyway
    process.exit(1);
  }
}
