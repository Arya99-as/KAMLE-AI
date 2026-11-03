import { Router } from "express";
import {
  createQuotation,
  getQuotationById,
  getQuotationForEnquiry,
  listMyQuotations,
  respondToQuotation,
  submitQuotation,
  updateQuotation,
} from "../controllers/quotationController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  customerQuotationResponseSchema,
  quotationPayloadSchema,
} from "../validators/quotation.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

// Static paths must be declared before "/:id".
router.get("/my", asyncHandler(listMyQuotations));
router.get("/for-enquiry/:enquiryId", asyncHandler(getQuotationForEnquiry));

router.post("/", authorize("worker"), validateBody(quotationPayloadSchema), asyncHandler(createQuotation));
router.patch("/:id", authorize("worker"), validateBody(quotationPayloadSchema), asyncHandler(updateQuotation));
router.post("/:id/submit", authorize("worker"), asyncHandler(submitQuotation));
router.post("/:id/respond", authorize("customer"), validateBody(customerQuotationResponseSchema), asyncHandler(respondToQuotation));

router.get("/:id", asyncHandler(getQuotationById));

export default router;
