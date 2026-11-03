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

// Kamle AI chat is accessible to all authenticated users (customer, worker, admin)
const chatAuth = [authenticate, authorize("customer", "admin", "worker")];

router.get("/chat/conversations", ...chatAuth, asyncHandler(listConversations));
router.post(
  "/chat/conversations",
  ...chatAuth,
  validateBody(createConversationSchema),
  asyncHandler(createConversation),
);
router.get("/chat/conversations/:id", ...chatAuth, asyncHandler(getConversation));
router.patch(
  "/chat/conversations/:id",
  ...chatAuth,
  validateBody(updateConversationSchema),
  asyncHandler(updateConversation),
);
router.delete("/chat/conversations/:id", ...chatAuth, asyncHandler(deleteConversation));

router.post(
  "/chat/message",
  aiLimiter,
  ...chatAuth,
  validateBody(chatMessageSchema),
  asyncHandler(sendMessage),
);

export default router;
