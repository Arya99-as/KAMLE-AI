import { Router } from "express";
import { register, login, me, updateMe, demoLogin } from "../controllers/authController.js";
import { validateBody } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { loginSchema, registerSchema, updateMeSchema, demoLoginSchema } from "../validators/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", authLimiter, validateBody(registerSchema), asyncHandler(register));
router.post("/login", authLimiter, validateBody(loginSchema), asyncHandler(login));
router.post("/demo-login", authLimiter, validateBody(demoLoginSchema), asyncHandler(demoLogin));
router.get("/me", authenticate, asyncHandler(me));
router.patch("/me", authenticate, validateBody(updateMeSchema), asyncHandler(updateMe));

export default router;
