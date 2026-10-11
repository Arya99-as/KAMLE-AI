import { Router } from "express";
import { addFavorite, listFavorites, removeFavorite } from "../controllers/favoriteController.js";
import { listCategories } from "../controllers/categoryController.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/favorites", authenticate, requireRole("customer"), asyncHandler(listFavorites));
router.post("/favorites/:workerId", authenticate, requireRole("customer"), asyncHandler(addFavorite));
router.delete("/favorites/:workerId", authenticate, requireRole("customer"), asyncHandler(removeFavorite));

router.get("/categories", asyncHandler(listCategories));

export default router;
