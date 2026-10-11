import { Router } from "express";
import {
  aiHealth,
  analytics,
  createCategory,
  dashboard,
  deleteCategory,
  listAllCategories,
  listAuditLogs,
  listPendingWorkers,
  listReports,
  listReviews,
  listUsers,
  moderateReview,
  setAccountStatus,
  setApproval,
  setReportStatus,
  updateCategory,
} from "../controllers/adminController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  accountStatusSchema,
  approvalSchema,
  categorySchema,
  categoryUpdateSchema,
  moderationSchema,
  reportStatusSchema,
} from "../validators/admin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Every admin route requires an authenticated admin. Enforced in the backend.
router.use(authenticate, requireRole("admin"));

router.get("/dashboard", asyncHandler(dashboard));
router.get("/analytics", asyncHandler(analytics));

router.get("/ai/health", asyncHandler(aiHealth));

router.get("/workers/pending", asyncHandler(listPendingWorkers));
router.patch("/workers/:id/approval", validateBody(approvalSchema), asyncHandler(setApproval));

router.get("/users", asyncHandler(listUsers));
router.patch("/users/:id/status", validateBody(accountStatusSchema), asyncHandler(setAccountStatus));

router.get("/reports", asyncHandler(listReports));
router.patch("/reports/:id/status", validateBody(reportStatusSchema), asyncHandler(setReportStatus));

router.get("/reviews", asyncHandler(listReviews));
router.patch("/reviews/:id/moderation", validateBody(moderationSchema), asyncHandler(moderateReview));

router.get("/categories", asyncHandler(listAllCategories));
router.post("/categories", validateBody(categorySchema), asyncHandler(createCategory));
router.patch("/categories/:id", validateBody(categoryUpdateSchema), asyncHandler(updateCategory));
router.delete("/categories/:id", asyncHandler(deleteCategory));

router.get("/audit-logs", asyncHandler(listAuditLogs));

export default router;
