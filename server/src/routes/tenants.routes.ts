import { Router } from "express";
import * as tenantsController from "../controllers/tenants.controller.js";
import { requireAuth, requirePlatformAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requirePlatformAdmin);

router.get("/", asyncHandler(tenantsController.listTenants));
router.post("/", asyncHandler(tenantsController.createTenant));
router.put("/:id", asyncHandler(tenantsController.updateTenant));
router.delete("/:id", asyncHandler(tenantsController.deleteTenant));

export default router;
