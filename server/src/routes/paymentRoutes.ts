import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  paymentWebhook,
  getMyPayments,
  getWorkerEarnings,
  getCommissionRate,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Provider webhook. Mounted before auth and verified via its own signature.
router.post("/webhook", asyncHandler(paymentWebhook));

router.get("/commission-rate", asyncHandler(getCommissionRate));

// Customer endpoints
router.post("/create-order", authenticate, authorize("customer"), asyncHandler(createOrder));
router.post("/verify", authenticate, authorize("customer"), asyncHandler(verifyPayment));
router.get("/my-payments", authenticate, authorize("customer"), asyncHandler(getMyPayments));

// Worker endpoints
router.get("/worker-earnings", authenticate, authorize("worker"), asyncHandler(getWorkerEarnings));

export default router;
