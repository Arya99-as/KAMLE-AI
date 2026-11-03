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
import ApiError from "./utils/ApiError.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.clientOrigins.includes(origin) || !env.isProd) return cb(null, true);
        return cb(ApiError.forbidden("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(morgan(env.isProd ? "combined" : "dev"));
  }

  // Only public portfolio images are served statically. Verification documents
  // live under uploadRoot/documents and are streamed exclusively to
  // authenticated admins via GET /api/admin/workers/:id/documents/:index.
  app.use("/uploads/images", express.static(path.join(uploadRoot, "images"), { maxAge: "7d" }));

  app.get("/", (_req, res) => {
    res.json({
      status: "ok",
      name: "KAMLE AI API",
      message: "Backend server is running. Access the frontend app at http://localhost:5174/",
      version: "1.0.0",
    });
  });

  app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(204).end();
  });

  app.use("/api", generalLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
