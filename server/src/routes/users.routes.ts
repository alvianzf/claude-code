import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(usersController.listUsers));
router.post("/", requireAdmin, asyncHandler(usersController.createUser));
router.put("/:id", requireAdmin, asyncHandler(usersController.updateUser));
router.delete("/:id", requireAdmin, asyncHandler(usersController.deleteUser));

export default router;
