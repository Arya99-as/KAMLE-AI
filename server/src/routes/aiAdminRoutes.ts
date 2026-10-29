import { Router } from "express";
import {
  overview,
  listLogs,
  getLogDetail,
  exportLogsCsv,
  listProviders,
  testProvider,
  usageAnalytics,
  costAnalytics,
  performanceAnalytics,
  errorAnalytics,
  retryOperation,
  listFeatures,
  updateFeature,
  listEvaluations,
  runEvaluation,
  getAuditLogs,
  getSettings,
  updateSettings,
} from "../controllers/aiAdminController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Strict backend authorization: only users with the verified "admin" role can access these endpoints
router.use(authenticate, authorize("admin"));

// AI Overview & Provider Status
router.get("/overview", asyncHandler(overview));
router.get("/providers", asyncHandler(listProviders));
router.post("/providers/test", asyncHandler(testProvider));

// Activity Logs & Request History
router.get("/logs", asyncHandler(listLogs));
router.get("/logs/export/csv", asyncHandler(exportLogsCsv));
router.get("/logs/:id", asyncHandler(getLogDetail));
router.get("/requests", asyncHandler(listLogs));

// Analytics, Costs, Performance & Errors
router.get("/analytics", asyncHandler(usageAnalytics));
router.get("/costs", asyncHandler(costAnalytics));
router.get("/performance", asyncHandler(performanceAnalytics));
router.get("/errors", asyncHandler(errorAnalytics));
router.post("/errors/:id/retry", asyncHandler(retryOperation));

// Features, Evaluations, Security & Settings
router.get("/features", asyncHandler(listFeatures));
router.patch("/features/:key", asyncHandler(updateFeature));
router.get("/evaluations", asyncHandler(listEvaluations));
router.post("/evaluations/run", asyncHandler(runEvaluation));
router.get("/audit", asyncHandler(getAuditLogs));
router.get("/settings", asyncHandler(getSettings));
router.put("/settings", asyncHandler(updateSettings));

export default router;
