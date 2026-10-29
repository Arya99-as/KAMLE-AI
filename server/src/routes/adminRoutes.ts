import { Router } from "express";
import aiAdminRoutes from "./aiAdminRoutes.js";
import {
  aiHealth,
  dashboard,
  listPendingWorkers,
  reviewWorkerApplication,
  listUsers,
  updateUserAccountStatus,
  listReviews,
  moderateReview,
  listReports,
  updateReportStatus,
  listCategories,
  createCategory,
  updateCategory,
  listPayments,
  listPayouts,
  updatePayoutStatus,
  getPlatformConfig,
  updatePlatformConfig,
  listAllEnquiries,
  resolveDispute,
} from "../controllers/adminController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  approvalSchema,
  accountStatusSchema,
  moderationSchema,
  reportStatusSchema,
  categorySchema,
  categoryUpdateSchema,
  resolveDisputeSchema,
  payoutStatusSchema,
} from "../validators/admin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate, authorize("admin"));

// AI Admin Control Center Routes
router.use("/ai", aiAdminRoutes);

router.get("/ai-health", asyncHandler(aiHealth));
router.get("/ai/health", asyncHandler(aiHealth));
router.get("/dashboard", asyncHandler(dashboard));

router.get("/workers/pending", asyncHandler(listPendingWorkers));
router.post("/workers/:id/review", validateBody(approvalSchema), asyncHandler(reviewWorkerApplication));
router.patch("/workers/:id/approval", validateBody(approvalSchema), asyncHandler(reviewWorkerApplication));

router.get("/users", asyncHandler(listUsers));
router.patch("/users/:id/status", validateBody(accountStatusSchema), asyncHandler(updateUserAccountStatus));

router.get("/enquiries", asyncHandler(listAllEnquiries));
router.post("/enquiries/:id/resolve-dispute", validateBody(resolveDisputeSchema), asyncHandler(resolveDispute));

router.get("/payments", asyncHandler(listPayments));
router.get("/payouts", asyncHandler(listPayouts));
router.patch("/payouts/:id/status", validateBody(payoutStatusSchema), asyncHandler(updatePayoutStatus));
router.get("/config", asyncHandler(getPlatformConfig));
router.put("/config", asyncHandler(updatePlatformConfig));

router.get("/reviews", asyncHandler(listReviews));
router.post("/reviews/:id/moderate", validateBody(moderationSchema), asyncHandler(moderateReview));
router.patch("/reviews/:id/moderation", validateBody(moderationSchema), asyncHandler(moderateReview));
router.get("/reports", asyncHandler(listReports));
router.patch("/reports/:id/status", validateBody(reportStatusSchema), asyncHandler(updateReportStatus));

router.get("/categories", asyncHandler(listCategories));
router.post("/categories", validateBody(categorySchema), asyncHandler(createCategory));
router.patch("/categories/:id", validateBody(categoryUpdateSchema), asyncHandler(updateCategory));

export default router;
