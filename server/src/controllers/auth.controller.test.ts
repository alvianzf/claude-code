import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import type { Tenant, User } from "../types.js";

const getUserByUsername = vi.fn();
const getTenantById = vi.fn();

vi.mock("../services/userStore.js", () => ({
  getUserByUsername: (...args: unknown[]) => getUserByUsername(...args),
}));

vi.mock("../services/tenantStore.js", () => ({
  getTenantById: (...args: unknown[]) => getTenantById(...args),
}));

vi.mock("../utils/password.js", () => ({
  comparePassword: vi.fn(async () => true),
}));

const { login } = await import("./auth.controller.js");

function makeUser(overrides: Partial<User>): User {
  return {
    id: "user-1",
    username: "admin",
    passwordHash: "hash",
    fullName: "Administrator",
    role: "admin",
    tenantId: "tenant-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTenant(overrides: Partial<Tenant>): Tenant {
  return {
    id: "tenant-1",
    name: "Default Tenant",
    slug: "default",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReqRes(body: Record<string, unknown>) {
  const req = { body } as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  return { req, res, status, json };
}

describe("auth.controller login - tenant suspension", () => {
  beforeEach(() => {
    getUserByUsername.mockReset();
    getTenantById.mockReset();
  });

  it("rejects login with 403 TENANT_SUSPENDED if the user's tenant is suspended", async () => {
    getUserByUsername.mockResolvedValue(makeUser({ tenantId: "tenant-1" }));
    getTenantById.mockResolvedValue(makeTenant({ status: "suspended" }));

    const { req, res } = makeReqRes({ username: "admin", password: "admin123" });

    await expect(login(req, res)).rejects.toThrow(ApiError);
    await expect(login(req, res)).rejects.toMatchObject({ status: 403, code: "TENANT_SUSPENDED" });
  });

  it("allows login when the tenant is active", async () => {
    getUserByUsername.mockResolvedValue(makeUser({ tenantId: "tenant-1" }));
    getTenantById.mockResolvedValue(makeTenant({ status: "active" }));

    const { req, res, status, json } = makeReqRes({ username: "admin", password: "admin123" });

    await login(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ tenantId: "tenant-1" }),
      })
    );
  });

  it("allows platform_admin (tenantId: null) to log in without a tenant lookup", async () => {
    getUserByUsername.mockResolvedValue(makeUser({ role: "platform_admin", tenantId: null }));

    const { req, res, status, json } = makeReqRes({ username: "platformadmin", password: "admin123" });

    await login(req, res);

    expect(getTenantById).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ tenantId: null }) })
    );
  });
});
