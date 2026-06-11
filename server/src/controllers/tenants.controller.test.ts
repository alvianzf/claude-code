import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { Tenant } from "../types.js";

const getTenantById = vi.fn();
const deleteTenant = vi.fn();
const countUsersByTenant = vi.fn();

vi.mock("../services/tenantStore.js", () => ({
  getTenantById: (...args: unknown[]) => getTenantById(...args),
  deleteTenant: (...args: unknown[]) => deleteTenant(...args),
}));

vi.mock("../services/userStore.js", () => ({
  countUsersByTenant: (...args: unknown[]) => countUsersByTenant(...args),
}));

const { deleteTenant: deleteTenantHandler } = await import("./tenants.controller.js");

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: "tenant-1",
    name: "Acme",
    slug: "acme",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReqRes(params: Record<string, string>) {
  const req = { params } as unknown as Request;
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const res = { status } as unknown as Response;
  return { req, res, status, send };
}

describe("tenants.controller deleteTenant", () => {
  beforeEach(() => {
    getTenantById.mockReset();
    deleteTenant.mockReset();
    countUsersByTenant.mockReset();
  });

  it("rejects with 400 TENANT_HAS_USERS when employeeCount > 0", async () => {
    getTenantById.mockResolvedValue(makeTenant());
    countUsersByTenant.mockResolvedValue(2);

    const { req, res } = makeReqRes({ id: "tenant-1" });

    await expect(deleteTenantHandler(req, res)).rejects.toMatchObject({
      status: 400,
      code: "TENANT_HAS_USERS",
    });
    expect(deleteTenant).not.toHaveBeenCalled();
  });

  it("returns 404 NOT_FOUND for an unknown tenant", async () => {
    getTenantById.mockResolvedValue(undefined);

    const { req, res } = makeReqRes({ id: "missing" });

    await expect(deleteTenantHandler(req, res)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("deletes and returns 204 when employeeCount is 0", async () => {
    getTenantById.mockResolvedValue(makeTenant());
    countUsersByTenant.mockResolvedValue(0);
    deleteTenant.mockResolvedValue(true);

    const { req, res, status, send } = makeReqRes({ id: "tenant-1" });

    await deleteTenantHandler(req, res);

    expect(deleteTenant).toHaveBeenCalledWith("tenant-1");
    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });
});
