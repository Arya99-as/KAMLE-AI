import { Router } from "express";
import authRoutes from "./authRoutes.js";
import workerRoutes from "./workerRoutes.js";
import searchRoutes from "./searchRoutes.js";
import interactionRoutes from "./interactionRoutes.js";
import commonRoutes from "./commonRoutes.js";
import adminRoutes from "./adminRoutes.js";
import { createReport } from "../controllers/reportController.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { reportSchema } from "../validators/interactions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", service: "kamle-ai", time: new Date().toISOString() }));

router.use("/auth", authRoutes);
router.use("/workers", workerRoutes);
router.use("/", searchRoutes); // /search, /chat/message
router.use("/", interactionRoutes); // /enquiries, /reviews
router.use("/", commonRoutes); // /favorites, /categories
router.post("/reports", authenticate, validateBody(reportSchema), asyncHandler(createReport));
router.use("/admin", adminRoutes);

export default router;
