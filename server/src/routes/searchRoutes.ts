import { Router } from "express";
import { search } from "../controllers/searchController.js";
import { sendMessage } from "../controllers/chatController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { searchBodySchema } from "../validators/search.js";
import { chatMessageSchema } from "../validators/chat.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/search", validateBody(searchBodySchema), asyncHandler(search));
// Kamle AI chat is a customer-only feature: authenticate + authorize("customer").
// Workers and admins receive 403; unauthenticated requests receive 401.
router.post("/chat/message", aiLimiter, authenticate, authorize("customer"), validateBody(chatMessageSchema), asyncHandler(sendMessage));

export default router;
