import { Router } from "express";
import {
  createPaymentRequest,
  getMyWorkerPaymentRequests,
  getCustomerPendingPaymentRequests,
  getPaymentRequestForEnquiry,
  getAdminPaymentRequests,
  adminDecidePayment,
  adminAuthorizePayout,
} from "../controllers/paymentRequestController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Worker endpoints
router.post("/", authenticate, authorize("worker"), asyncHandler(createPaymentRequest));
router.get("/my", authenticate, authorize("worker"), asyncHandler(getMyWorkerPaymentRequests));

// Customer endpoints
router.get("/customer-pending", authenticate, authorize("customer"), asyncHandler(getCustomerPendingPaymentRequests));

// Single enquiry lookup (Worker, Customer, Admin)
router.get("/for-enquiry/:enquiryId", authenticate, asyncHandler(getPaymentRequestForEnquiry));

// Admin endpoints
router.get("/admin", authenticate, authorize("admin"), asyncHandler(getAdminPaymentRequests));
router.post("/admin/:id/decision", authenticate, authorize("admin"), asyncHandler(adminDecidePayment));
router.post("/admin/authorize-payout", authenticate, authorize("admin"), asyncHandler(adminAuthorizePayout));

export default router;
