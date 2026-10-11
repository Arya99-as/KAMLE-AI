import { Router } from "express";
import { createEnquiry, listMyEnquiries, updateEnquiryStatus } from "../controllers/enquiryController.js";
import { createReview, listMyReviews } from "../controllers/reviewController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createEnquirySchema, reviewSchema, updateEnquiryStatusSchema } from "../validators/interactions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/enquiries", authenticate, requireRole("customer"), validateBody(createEnquirySchema), asyncHandler(createEnquiry));
router.get("/enquiries/me", authenticate, asyncHandler(listMyEnquiries));
router.patch("/enquiries/:id/status", authenticate, requireRole("worker", "customer"), validateBody(updateEnquiryStatusSchema), asyncHandler(updateEnquiryStatus));

router.post("/reviews", authenticate, requireRole("customer"), validateBody(reviewSchema), asyncHandler(createReview));
router.get("/reviews/me", authenticate, asyncHandler(listMyReviews));

export default router;
