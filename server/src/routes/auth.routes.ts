import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/login", asyncHandler(authController.login));
router.get("/tenant/:slug", asyncHandler(authController.getTenantDetails));
router.get("/me", requireAuth, asyncHandler(authController.me));

export default router;
