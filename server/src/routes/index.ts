import { Router } from "express";
import mongoose from "mongoose";
import authRoutes from "./authRoutes.js";
import workerRoutes from "./workerRoutes.js";
import searchRoutes from "./searchRoutes.js";
import interactionRoutes from "./interactionRoutes.js";
import commonRoutes from "./commonRoutes.js";
import adminRoutes from "./adminRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import { createReport } from "../controllers/reportController.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { reportSchema } from "../validators/interactions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Liveness + readiness probe: reports API status and MongoDB connectivity.
router.get("/health", asyncHandler(async (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    service: "kamle-ai",
    time: new Date().toISOString(),
    db: dbStatus,
  });
}));

router.use("/auth", authRoutes);
router.use("/workers", workerRoutes);
router.use("/payments", paymentRoutes);
router.use("/", searchRoutes);
router.use("/", interactionRoutes);
router.use("/", commonRoutes);
router.post("/reports", authenticate, validateBody(reportSchema), asyncHandler(createReport));
router.use("/admin", adminRoutes);

export default router;
