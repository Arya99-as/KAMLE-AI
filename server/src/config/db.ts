import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";

let memoryServer: { getUri: () => string; stop: () => Promise<boolean> } | null = null;

export async function connectDB(): Promise<string> {
  let uri = env.mongoUri;

  if (env.useMemoryDb) {
    if (env.isProd) {
      throw new Error("USE_MEMORY_DB must be false in production");
    }
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    memoryServer = mem;
    uri = mem.getUri();
    logger.info("Using in-memory MongoDB instance (USE_MEMORY_DB=true)");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: !env.isProd,
  });

  logger.info("Connected to MongoDB");

  mongoose.connection.on("error", (err) => logger.error("MongoDB error", err));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  return uri;
}

export async function syncIndexes(): Promise<void> {
  const models = mongoose.models;
  const entries = Object.values(models);
  for (const model of entries) {
    if (typeof (model as any).syncIndexes === "function") {
      try {
        await (model as any).syncIndexes();
      } catch (err) {
        logger.warn("Failed to sync indexes for model", err instanceof Error ? { name: err.name, message: err.message } : err);
      }
    }
  }
  logger.info("Index sync completed");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export default connectDB;
