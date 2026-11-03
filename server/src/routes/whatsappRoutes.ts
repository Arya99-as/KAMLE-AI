import { Router } from "express";
import { verifyWebhook, handleWebhook } from "../controllers/whatsappController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/webhook", asyncHandler(verifyWebhook));
router.post("/webhook", asyncHandler(handleWebhook));

export default router;
