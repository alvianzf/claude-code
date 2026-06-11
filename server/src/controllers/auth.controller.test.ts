import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import type { Tenant, User } from "../types.js";

const getUserByUsername = vi.fn();
const getTenantBySlug = vi.fn();

vi.mock("../services/userStore.js", () => ({
  getUserByUsername: (...args: unknown[]) => getUserByUsername(...args),
}));

vi.mock("../services/tenantStore.js", () => ({
  getTenantBySlug: (...args: unknown[]) => getTenantBySlug(...args),
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

describe("auth.controller login - tenant-scoped lookup", () => {
  beforeEach(() => {
    getUserByUsername.mockReset();
    getTenantBySlug.mockReset();
  });

  it("rejects login with 401 INVALID_CREDENTIALS for an unknown tenantSlug", async () => {
    getTenantBySlug.mockResolvedValue(undefined);

    const { req, res } = makeReqRes({ username: "admin", password: "admin123", tenantSlug: "nope" });

    await expect(login(req, res)).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(getUserByUsername).not.toHaveBeenCalled();
  });

  it("rejects login with 403 TENANT_SUSPENDED if the resolved tenant is suspended", async () => {
    getTenantBySlug.mockResolvedValue(makeTenant({ status: "suspended" }));
    getUserByUsername.mockResolvedValue(makeUser({ tenantId: "tenant-1" }));

    const { req, res } = makeReqRes({ username: "admin", password: "admin123", tenantSlug: "default" });

    await expect(login(req, res)).rejects.toMatchObject({ status: 403, code: "TENANT_SUSPENDED" });
  });

  it("allows login when the resolved tenant is active", async () => {
    getTenantBySlug.mockResolvedValue(makeTenant({ status: "active" }));
    getUserByUsername.mockResolvedValue(makeUser({ tenantId: "tenant-1" }));

    const { req, res, status, json } = makeReqRes({
      username: "admin",
      password: "admin123",
      tenantSlug: "default",
    });

    await login(req, res);

    expect(getUserByUsername).toHaveBeenCalledWith("admin", "tenant-1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ tenantId: "tenant-1" }),
      })
    );
  });

  it("allows platform_admin (tenantId: null) to log in with no tenantSlug", async () => {
    getUserByUsername.mockResolvedValue(makeUser({ role: "platform_admin", tenantId: null }));

    const { req, res, status, json } = makeReqRes({ username: "platformadmin", password: "admin123" });

    await login(req, res);

    expect(getTenantBySlug).not.toHaveBeenCalled();
    expect(getUserByUsername).toHaveBeenCalledWith("platformadmin", null);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ tenantId: null }) })
    );
  });

  it("treats a blank tenantSlug the same as no tenantSlug (platform pool)", async () => {
    getUserByUsername.mockResolvedValue(makeUser({ role: "platform_admin", tenantId: null }));

    const { req, res, status } = makeReqRes({
      username: "platformadmin",
      password: "admin123",
      tenantSlug: "  ",
    });

    await login(req, res);

    expect(getTenantBySlug).not.toHaveBeenCalled();
    expect(getUserByUsername).toHaveBeenCalledWith("platformadmin", null);
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects with 401 INVALID_CREDENTIALS when no user exists in the resolved scope", async () => {
    getUserByUsername.mockResolvedValue(undefined);

    const { req, res } = makeReqRes({ username: "ghost", password: "admin123" });

    await expect(login(req, res)).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });
});

describe("auth.controller login - validation", () => {
  beforeEach(() => {
    getUserByUsername.mockReset();
    getTenantBySlug.mockReset();
  });

  it("rejects with 400 VALIDATION_ERROR when username or password is missing", async () => {
    const { req, res } = makeReqRes({ username: "admin" });

    await expect(login(req, res)).rejects.toBeInstanceOf(ApiError);
    await expect(login(req, res)).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });
});
