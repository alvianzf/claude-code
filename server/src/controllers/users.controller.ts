import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as userStore from "../services/userStore.js";
import * as tenantStore from "../services/tenantStore.js";
import { hashPassword } from "../utils/password.js";
import { toPublicUser } from "../utils/serialize.js";
import { ApiError } from "../utils/ApiError.js";
import {
  validateUsername,
  validatePassword,
  validateFullName,
  validateRole,
} from "../utils/validation.js";

export async function listUsers(req: Request, res: Response): Promise<void> {
  let tenantId = req.user!.tenantId;
  if (req.user!.role === "platform_admin" && typeof req.query.tenantId === "string") {
    tenantId = req.query.tenantId === "null" || req.query.tenantId === "" ? null : req.query.tenantId;
  }
  const users = await userStore.getUsersByTenant(tenantId);
  res.status(200).json({ users: users.map(toPublicUser) });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  
  let tenantId = req.user!.tenantId;
  let role;

  if (req.user!.role === "platform_admin") {
    if (typeof body.tenantId === "string" && body.tenantId.trim() !== "") {
      tenantId = body.tenantId.trim();
      role = validateRole(body.role);
    } else {
      tenantId = null;
      role = "platform_admin" as const;
    }
  } else {
    role = tenantId === null ? "platform_admin" as const : validateRole(body.role);
  }

  if (tenantId !== null) {
    const tenant = await tenantStore.getTenantById(tenantId);
    if (!tenant) {
      throw new ApiError(404, "NOT_FOUND", "Tenant not found");
    }
  }

  const username = validateUsername(body.username);
  const password = validatePassword(body.password, true)!;
  const fullName = validateFullName(body.fullName);

  const existing = await userStore.getUserByUsername(username, tenantId);
  if (existing) {
    throw new ApiError(409, "USERNAME_TAKEN", "Username is already taken");
  }

  const now = new Date().toISOString();
  const user = await userStore.addUser({
    id: uuidv4(),
    username,
    passwordHash: await hashPassword(password),
    fullName,
    role,
    tenantId,
    createdAt: now,
    updatedAt: now,
  });

  res.status(201).json({ user: toPublicUser(user) });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  const existing = await userStore.getUserById(id);
  if (!existing || (req.user!.role !== "platform_admin" && existing.tenantId !== req.user!.tenantId)) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  const updates: Partial<{
    username: string;
    passwordHash: string;
    fullName: string;
    role: "admin" | "user";
    updatedAt: string;
  }> = {};

  if (body.username !== undefined) {
    const username = validateUsername(body.username);
    const other = await userStore.getUserByUsername(username, existing.tenantId);
    if (other && other.id !== id) {
      throw new ApiError(409, "USERNAME_TAKEN", "Username is already taken");
    }
    updates.username = username;
  }

  if (body.password !== undefined && body.password !== "") {
    const password = validatePassword(body.password, false);
    if (password) {
      updates.passwordHash = await hashPassword(password);
    }
  }

  if (body.fullName !== undefined) {
    updates.fullName = validateFullName(body.fullName);
  }

  if (existing.tenantId !== null && body.role !== undefined) {
    const role = validateRole(body.role);
    if (existing.role === "admin" && role === "user") {
      const users = await userStore.readUsers();
      if (userStore.countAdmins(users, existing.tenantId) <= 1) {
        throw new ApiError(400, "LAST_ADMIN", "Cannot demote the last remaining admin");
      }
    }
    updates.role = role;
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await userStore.updateUser(id, updates);
  res.status(200).json({ user: toPublicUser(updated!) });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await userStore.getUserById(id);
  if (!existing || (req.user!.role !== "platform_admin" && existing.tenantId !== req.user!.tenantId)) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (existing.role === "admin" || existing.role === "platform_admin") {
    const users = await userStore.readUsers();
    if (userStore.countAdmins(users, existing.tenantId) <= 1) {
      throw new ApiError(400, "LAST_ADMIN", "Cannot delete the last remaining admin");
    }
  }

  await userStore.deleteUser(id);
  res.status(204).send();
}
