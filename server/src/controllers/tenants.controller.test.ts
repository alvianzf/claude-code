import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { Tenant } from "../types.js";

const getTenantById = vi.fn();
const deleteTenant = vi.fn();
const readTenants = vi.fn();
const addTenant = vi.fn();
const countUsersByTenant = vi.fn();
const addUser = vi.fn();

vi.mock("../services/tenantStore.js", () => ({
  getTenantById: (...args: unknown[]) => getTenantById(...args),
  deleteTenant: (...args: unknown[]) => deleteTenant(...args),
  readTenants: (...args: unknown[]) => readTenants(...args),
  addTenant: (...args: unknown[]) => addTenant(...args),
}));

vi.mock("../services/userStore.js", () => ({
  countUsersByTenant: (...args: unknown[]) => countUsersByTenant(...args),
  addUser: (...args: unknown[]) => addUser(...args),
}));

const { deleteTenant: deleteTenantHandler, createTenant: createTenantHandler } = await import(
  "./tenants.controller.js"
);

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

function makeReqRes(params: Record<string, string>, body: Record<string, unknown> = {}) {
  const req = { params, body } as unknown as Request;
  const send = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ send, json }));
  const res = { status } as unknown as Response;
  return { req, res, status, send, json };
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

describe("tenants.controller createTenant - optional initial admin", () => {
  beforeEach(() => {
    readTenants.mockReset();
    addTenant.mockReset();
    addUser.mockReset();

    readTenants.mockResolvedValue([]);
    addTenant.mockImplementation((tenant: Tenant) => Promise.resolve(tenant));
  });

  it("creates a tenant without an admin when `admin` is omitted", async () => {
    const { req, res, status, json } = makeReqRes({}, { name: "Acme Corp" });

    await createTenantHandler(req, res);

    expect(addUser).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: expect.objectContaining({ name: "Acme Corp", employeeCount: 0 }),
      })
    );
    expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ adminUser: expect.anything() }));
  });

  it("creates a tenant and its initial admin when `admin` is provided", async () => {
    addUser.mockImplementation((user) => Promise.resolve(user));

    const { req, res, status, json } = makeReqRes(
      {},
      {
        name: "Acme Corp",
        admin: { username: "acme_admin", password: "supersecret", fullName: "Acme Admin" },
      }
    );

    await createTenantHandler(req, res);

    expect(addUser).toHaveBeenCalledWith(
      expect.objectContaining({ username: "acme_admin", role: "admin", tenantId: expect.any(String) })
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: expect.objectContaining({ name: "Acme Corp", employeeCount: 1 }),
        adminUser: expect.objectContaining({ username: "acme_admin" }),
      })
    );
  });
});
