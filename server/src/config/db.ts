import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";

let memoryServer: { getUri: () => string; stop: () => Promise<boolean> } | null = null;

export async function connectDB(): Promise<string> {
  let uri = env.mongoUri;

  if (env.useMemoryDb) {
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

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export default connectDB;
