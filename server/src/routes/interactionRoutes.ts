import { Router } from "express";
import { createEnquiry, listMyEnquiries, updateEnquiryStatus, getEnquiryById, confirmCompletion } from "../controllers/enquiryController.js";
import { createReview, listWorkerReviews, listMyReviews } from "../controllers/reviewController.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createEnquirySchema, updateEnquiryStatusSchema, reviewSchema } from "../validators/interactions.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/enquiries", authenticate, validateBody(createEnquirySchema), asyncHandler(createEnquiry));
router.get("/enquiries", authenticate, asyncHandler(listMyEnquiries));
router.get("/enquiries/:id", authenticate, asyncHandler(getEnquiryById));
router.patch("/enquiries/:id/status", authenticate, validateBody(updateEnquiryStatusSchema), asyncHandler(updateEnquiryStatus));
router.post("/enquiries/:id/confirm", authenticate, asyncHandler(confirmCompletion));

router.post("/reviews", authenticate, validateBody(reviewSchema), asyncHandler(createReview));
router.get("/reviews/my", authenticate, asyncHandler(listMyReviews));
router.get("/workers/:id/reviews", asyncHandler(listWorkerReviews));

export default router;
