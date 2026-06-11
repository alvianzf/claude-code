import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as tenantStore from "../services/tenantStore.js";
import * as userStore from "../services/userStore.js";
import { hashPassword } from "../utils/password.js";
import { toPublicUser } from "../utils/serialize.js";
import { ApiError } from "../utils/ApiError.js";
import {
  validateTenantName,
  validateTenantSlug,
  validateTenantStatus,
  validateUsername,
  validatePassword,
  validateFullName,
  slugify,
} from "../utils/validation.js";
import type { Tenant } from "../types.js";

export async function listTenants(_req: Request, res: Response): Promise<void> {
  const tenants = await tenantStore.readTenants();
  const tenantsWithCounts = await Promise.all(
    tenants.map(async (tenant) => ({
      ...tenant,
      employeeCount: await userStore.countUsersByTenant(tenant.id),
    }))
  );
  res.status(200).json({ tenants: tenantsWithCounts });
}

export async function createTenant(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;

  const name = validateTenantName(body.name);

  // Validate the optional initial admin up front so we never leave behind an
  // orphaned tenant if the admin's username/password/fullName are invalid or taken.
  let admin: { username: string; password: string; fullName: string } | undefined;
  if (body.admin !== undefined && body.admin !== null) {
    const adminBody = body.admin as Record<string, unknown>;
    const username = validateUsername(adminBody.username);
    const password = validatePassword(adminBody.password, true)!;
    const fullName = validateFullName(adminBody.fullName);

    if (await userStore.getUserByUsername(username)) {
      throw new ApiError(409, "USERNAME_TAKEN", "Username is already taken");
    }
    admin = { username, password, fullName };
  }

  const existingTenants = await tenantStore.readTenants();
  const existingSlugs = new Set(existingTenants.map((t) => t.slug));

  let slug: string;
  if (body.slug !== undefined && body.slug !== "") {
    slug = validateTenantSlug(body.slug);
    if (existingSlugs.has(slug)) {
      throw new ApiError(409, "SLUG_TAKEN", "Slug is already taken");
    }
  } else {
    slug = slugify(name, existingSlugs);
  }

  const status = body.status !== undefined ? validateTenantStatus(body.status) : "active";

  const now = new Date().toISOString();
  const tenant = await tenantStore.addTenant({
    id: uuidv4(),
    name,
    slug,
    status,
    createdAt: now,
    updatedAt: now,
  });

  let adminUser;
  if (admin) {
    adminUser = await userStore.addUser({
      id: uuidv4(),
      username: admin.username,
      passwordHash: await hashPassword(admin.password),
      fullName: admin.fullName,
      role: "admin",
      tenantId: tenant.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  res.status(201).json({
    tenant: { ...tenant, employeeCount: adminUser ? 1 : 0 },
    ...(adminUser ? { adminUser: toPublicUser(adminUser) } : {}),
  });
}

export async function updateTenant(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  const existing = await tenantStore.getTenantById(id);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Tenant not found");
  }

  const updates: Partial<Tenant> = {};

  if (body.name !== undefined) {
    updates.name = validateTenantName(body.name);
  }

  if (body.slug !== undefined && body.slug !== "") {
    const slug = validateTenantSlug(body.slug);
    const other = await tenantStore.getTenantBySlug(slug);
    if (other && other.id !== id) {
      throw new ApiError(409, "SLUG_TAKEN", "Slug is already taken");
    }
    updates.slug = slug;
  }

  if (body.status !== undefined) {
    updates.status = validateTenantStatus(body.status);
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await tenantStore.updateTenant(id, updates);
  res.status(200).json({ tenant: updated! });
}

export async function deleteTenant(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await tenantStore.getTenantById(id);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Tenant not found");
  }

  const employeeCount = await userStore.countUsersByTenant(id);
  if (employeeCount > 0) {
    throw new ApiError(400, "TENANT_HAS_USERS", "Cannot delete a tenant that still has users");
  }

  await tenantStore.deleteTenant(id);
  res.status(204).send();
}
