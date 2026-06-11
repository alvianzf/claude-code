import type { Request, Response } from "express";
import * as userStore from "../services/userStore.js";
import * as tenantStore from "../services/tenantStore.js";
import { comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { toPublicUser } from "../utils/serialize.js";
import { ApiError } from "../utils/ApiError.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password, tenantSlug } = req.body as {
    username?: unknown;
    password?: unknown;
    tenantSlug?: unknown;
  };

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    throw new ApiError(400, "VALIDATION_ERROR", "Username and password are required");
  }

  let tenantId: string | null = null;
  let tenant;
  if (typeof tenantSlug === "string" && tenantSlug.trim() !== "") {
    tenant = await tenantStore.getTenantBySlug(tenantSlug.trim());
    if (!tenant) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    }
    tenantId = tenant.id;
  }

  const user = await userStore.getUserByUsername(username, tenantId);
  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  if (tenant && tenant.status === "suspended") {
    throw new ApiError(
      403,
      "TENANT_SUSPENDED",
      "Your organization's account has been suspended"
    );
  }

  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
  });
  res.status(200).json({ token, user: toPublicUser(user) });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await userStore.getUserById(req.user!.sub);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "User no longer exists");
  }
  res.status(200).json({ user: toPublicUser(user) });
}
