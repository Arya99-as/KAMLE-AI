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
  listAuditLogs,
  getWorkerDocument,
  getPaymentDetail,
  reconcilePayment,
} from "../controllers/adminController.js";
import {
  listAllQuotations,
  decideQuotation,
  updateQuotationRemarks,
} from "../controllers/quotationController.js";
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
import {
  adminQuotationDecisionSchema,
  adminQuotationRemarksSchema,
  paymentReconcileSchema,
} from "../validators/quotation.js";
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
// Private verification document streaming (admin only). Verification docs are
// never exposed through the public /uploads static mount.
router.get("/workers/:id/documents/:index", asyncHandler(getWorkerDocument));

router.get("/users", asyncHandler(listUsers));
router.patch("/users/:id/status", validateBody(accountStatusSchema), asyncHandler(updateUserAccountStatus));

router.get("/enquiries", asyncHandler(listAllEnquiries));
router.post("/enquiries/:id/resolve-dispute", validateBody(resolveDisputeSchema), asyncHandler(resolveDispute));

router.get("/quotations", asyncHandler(listAllQuotations));
router.post("/quotations/:id/decision", validateBody(adminQuotationDecisionSchema), asyncHandler(decideQuotation));
router.patch("/quotations/:id/remarks", validateBody(adminQuotationRemarksSchema), asyncHandler(updateQuotationRemarks));

router.get("/payments/:id", asyncHandler(getPaymentDetail));
router.post("/payments/:id/reconcile", validateBody(paymentReconcileSchema), asyncHandler(reconcilePayment));
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

router.get("/audit-logs", asyncHandler(listAuditLogs));

export default router;
