import path from "node:path";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import env from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { uploadRoot } from "./middleware/upload.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.clientOrigins.includes(origin) || !env.isProd) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(morgan(env.isProd ? "combined" : "dev"));
  }

  // Serve uploaded portfolio images / documents.
  app.use("/uploads", express.static(path.resolve(uploadRoot), { maxAge: "7d" }));

  app.use("/api", generalLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
