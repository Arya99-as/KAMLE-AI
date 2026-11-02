import { createApp } from "./app.js";
import { connectDB, disconnectDB, syncIndexes } from "./config/db.js";
import env from "./config/env.js";
import logger from "./utils/logger.js";
import User from "./models/User.js";
import { seedDatabase } from "./seed.js";

async function main() {
  await connectDB();
  // In production autoIndex is disabled; build indexes explicitly via the
  // idempotent Mongoose syncIndexes() pass so deployments never start on a
  // schema without the required indexes.
  await syncIndexes();

  // Auto-seed demo accounts (admin, customer, worker) if database is empty or using in-memory db
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    logger.info("Database is empty. Automatically seeding demo accounts...");
    await seedDatabase(false);
  }

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
