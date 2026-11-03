import { Router } from "express";
import { search } from "../controllers/searchController.js";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendMessage,
  updateConversation,
} from "../controllers/chatController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { searchBodySchema } from "../validators/search.js";
import {
  chatMessageSchema,
  createConversationSchema,
  updateConversationSchema,
} from "../validators/chat.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/search", validateBody(searchBodySchema), asyncHandler(search));

// Kamle AI chat is a customer-only feature. Every conversation route requires
// an authenticated customer; workers and admins receive 403.
const customerOnly = [authenticate, authorize("customer")];

router.get("/chat/conversations", ...customerOnly, asyncHandler(listConversations));
router.post(
  "/chat/conversations",
  ...customerOnly,
  validateBody(createConversationSchema),
  asyncHandler(createConversation),
);
router.get("/chat/conversations/:id", ...customerOnly, asyncHandler(getConversation));
router.patch(
  "/chat/conversations/:id",
  ...customerOnly,
  validateBody(updateConversationSchema),
  asyncHandler(updateConversation),
);
router.delete("/chat/conversations/:id", ...customerOnly, asyncHandler(deleteConversation));

router.post(
  "/chat/message",
  aiLimiter,
  ...customerOnly,
  validateBody(chatMessageSchema),
  asyncHandler(sendMessage),
);

export default router;
