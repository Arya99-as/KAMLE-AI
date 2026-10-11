import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import env from "./config/env.js";
import logger from "./utils/logger.js";

async function main() {
  await connectDB();
  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`KAMLE AI API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    logger.info(`AI provider: ${env.ai.provider}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
