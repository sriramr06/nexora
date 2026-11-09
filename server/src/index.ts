import { createApp } from "./app";
import { logger } from "./common/logger";
import { env } from "./config/env";

const port = env.PORT; // already a number (z.coerce)

createApp().listen(port, () => {
  logger.info(`Nexora API listening on http://localhost:${port}`);
});
