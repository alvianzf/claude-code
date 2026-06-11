import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth, requireUserManager } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(usersController.listUsers));
router.post("/", requireUserManager, asyncHandler(usersController.createUser));
router.put("/:id", requireUserManager, asyncHandler(usersController.updateUser));
router.delete("/:id", requireUserManager, asyncHandler(usersController.deleteUser));

export default router;
