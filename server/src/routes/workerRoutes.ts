import { Router } from "express";
import {
  createProfile,
  getMyProfile,
  getWorker,
  listWorkers,
  recommendedWorkers,
  submitProfile,
  updateProfile,
  uploadDocuments,
  uploadPortfolio,
} from "../controllers/workerController.js";
import { listWorkerReviews } from "../controllers/reviewController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { uploadDocument, uploadImage } from "../middleware/upload.js";
import { workerProfileSchema, workerProfileUpdateSchema } from "../validators/worker.js";
import { searchQuerySchema } from "../validators/search.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Public discovery
router.get("/", validateQuery(searchQuerySchema), asyncHandler(listWorkers));
router.get("/recommended", asyncHandler(recommendedWorkers));

// Worker-owned routes (must be declared before "/:id")
router.get("/me/profile", authenticate, requireRole("worker"), asyncHandler(getMyProfile));
router.post("/profile", authenticate, requireRole("worker"), validateBody(workerProfileSchema), asyncHandler(createProfile));
router.patch("/profile", authenticate, requireRole("worker"), validateBody(workerProfileUpdateSchema), asyncHandler(updateProfile));
router.post("/me/submit", authenticate, requireRole("worker"), asyncHandler(submitProfile));
router.post("/me/portfolio", authenticate, requireRole("worker"), uploadImage.array("images", 8), asyncHandler(uploadPortfolio));
router.post("/me/documents", authenticate, requireRole("worker"), uploadDocument.array("documents", 5), asyncHandler(uploadDocuments));

// Public single profile + reviews
router.get("/:id/reviews", asyncHandler(listWorkerReviews));
router.get("/:id", asyncHandler(getWorker));

export default router;
