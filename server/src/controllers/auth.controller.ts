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
  res.status(200).json({
    token,
    user: {
      ...toPublicUser(user),
      tenantSlug: tenant ? tenant.slug : null,
    },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await userStore.getUserById(req.user!.sub);
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "User no longer exists");
  }
  let tenantSlug: string | null = null;
  if (user.tenantId) {
    const tenant = await tenantStore.getTenantById(user.tenantId);
    if (tenant) {
      tenantSlug = tenant.slug;
    }
  }
  res.status(200).json({
    user: {
      ...toPublicUser(user),
      tenantSlug,
    },
  });
}

export async function getTenantDetails(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug || typeof slug !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Tenant slug is required");
  }
  const tenant = await tenantStore.getTenantBySlug(slug.trim());
  if (!tenant) {
    throw new ApiError(404, "TENANT_NOT_FOUND", "Workspace not found");
  }
  res.status(200).json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
  });
}
