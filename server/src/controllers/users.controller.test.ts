import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { User } from "../types.js";

const getUserById = vi.fn();
const getUserByUsername = vi.fn();
const getUsersByTenant = vi.fn();
const readUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
const addUser = vi.fn();
const getTenantById = vi.fn();

vi.mock("../services/userStore.js", async () => {
  const actual = await vi.importActual<typeof import("../services/userStore.js")>(
    "../services/userStore.js"
  );
  return {
    ...actual,
    getUserById: (...args: unknown[]) => getUserById(...args),
    getUserByUsername: (...args: unknown[]) => getUserByUsername(...args),
    getUsersByTenant: (...args: unknown[]) => getUsersByTenant(...args),
    readUsers: (...args: unknown[]) => readUsers(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
    deleteUser: (...args: unknown[]) => deleteUser(...args),
    addUser: (...args: unknown[]) => addUser(...args),
  };
});

vi.mock("../services/tenantStore.js", () => ({
  getTenantById: (...args: unknown[]) => getTenantById(...args),
}));

const {
  listUsers: listUsersHandler,
  createUser: createUserHandler,
  updateUser: updateUserHandler,
  deleteUser: deleteUserHandler,
} = await import("./users.controller.js");

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "admin1",
    passwordHash: "hash",
    fullName: "Admin One",
    role: "admin",
    tenantId: "tenant-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReqRes(
  params: Record<string, string>,
  body: Record<string, unknown> = {},
  caller: { role: string; tenantId: string | null } = { role: "admin", tenantId: "tenant-a" }
) {
  const req = {
    params,
    body,
    user: { sub: "caller", username: "caller", ...caller },
  } as unknown as Request;
  const send = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ send, json }));
  const res = { status } as unknown as Response;
  return { req, res, status, send, json };
}

describe("users.controller - per-tenant LAST_ADMIN", () => {
  beforeEach(() => {
    getUserById.mockReset();
    getUserByUsername.mockReset();
    getUsersByTenant.mockReset();
    readUsers.mockReset();
    updateUser.mockReset();
    deleteUser.mockReset();
  });

  it("blocks demoting the last admin in the caller's tenant even if other tenants have admins", async () => {
    const target = makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" });
    getUserById.mockResolvedValue(target);

    readUsers.mockResolvedValue([
      makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" }),
      makeUser({ id: "user-2", role: "admin", tenantId: "tenant-b" }),
      makeUser({ id: "user-3", role: "admin", tenantId: "tenant-b" }),
    ]);

    const { req, res } = makeReqRes({ id: "user-1" }, { role: "user" });

    await expect(updateUserHandler(req, res)).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN",
    });
  });

  it("allows demoting an admin when another admin exists in the same tenant", async () => {
    const target = makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" });
    getUserById.mockResolvedValue(target);
    readUsers.mockResolvedValue([
      makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" }),
      makeUser({ id: "user-2", role: "admin", tenantId: "tenant-a" }),
    ]);
    updateUser.mockResolvedValue({ ...target, role: "user", updatedAt: "2026-01-02T00:00:00.000Z" });

    const { req, res, status } = makeReqRes({ id: "user-1" }, { role: "user" });

    await updateUserHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns 404 NOT_FOUND when target user belongs to a different tenant (cross-tenant)", async () => {
    getUserById.mockResolvedValue(makeUser({ id: "user-9", tenantId: "tenant-b" }));

    const { req, res } = makeReqRes({ id: "user-9" }, { fullName: "Hacked" });

    await expect(updateUserHandler(req, res)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("blocks deleting the last admin in the caller's tenant", async () => {
    const target = makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" });
    getUserById.mockResolvedValue(target);
    readUsers.mockResolvedValue([makeUser({ id: "user-1", role: "admin", tenantId: "tenant-a" })]);

    const { req, res } = makeReqRes({ id: "user-1" });

    await expect(deleteUserHandler(req, res)).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("users.controller - platform admin pool (tenantId: null)", () => {
  const platformCaller = { role: "platform_admin", tenantId: null };

  beforeEach(() => {
    getUserById.mockReset();
    getUserByUsername.mockReset();
    getUsersByTenant.mockReset();
    readUsers.mockReset();
    updateUser.mockReset();
    deleteUser.mockReset();
    addUser.mockReset();
    getTenantById.mockReset();
  });

  it("forces role=platform_admin and tenantId=null when creating a user in the platform pool", async () => {
    getUserByUsername.mockResolvedValue(undefined);
    addUser.mockImplementation((user) => Promise.resolve(user));

    const { req, res, status, json } = makeReqRes(
      {},
      { username: "platform2", password: "password123", fullName: "Second Platform Admin", role: "user" },
      platformCaller
    );

    await createUserHandler(req, res);

    expect(getUserByUsername).toHaveBeenCalledWith("platform2", null);
    expect(addUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "platform_admin", tenantId: null })
    );
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: "platform_admin" }) })
    );
  });

  it("allows the same username in a tenant and the platform pool (per-pool uniqueness)", async () => {
    // No existing user with this username in the platform pool, even though
    // a tenant user with the same username may exist elsewhere.
    getUserByUsername.mockResolvedValue(undefined);
    addUser.mockImplementation((user) => Promise.resolve(user));

    const { req, res, status } = makeReqRes(
      {},
      { username: "admin", password: "password123", fullName: "Platform Admin" },
      platformCaller
    );

    await createUserHandler(req, res);

    expect(getUserByUsername).toHaveBeenCalledWith("admin", null);
    expect(status).toHaveBeenCalledWith(201);
  });

  it("allows platform admin to create a user for a specific tenant", async () => {
    getUserByUsername.mockResolvedValue(undefined);
    getTenantById.mockResolvedValue({ id: "tenant-a", name: "Tenant A" });
    addUser.mockImplementation((user) => Promise.resolve(user));

    const { req, res, status } = makeReqRes(
      {},
      { username: "tenantuser", password: "password123", fullName: "Tenant User", role: "user", tenantId: "tenant-a" },
      platformCaller
    );

    await createUserHandler(req, res);

    expect(getTenantById).toHaveBeenCalledWith("tenant-a");
    expect(addUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", tenantId: "tenant-a" })
    );
    expect(status).toHaveBeenCalledWith(201);
  });

  it("throws 404 when platform admin creates user for non-existent tenant", async () => {
    getTenantById.mockResolvedValue(undefined);

    const { req, res } = makeReqRes(
      {},
      { username: "tenantuser", password: "password123", fullName: "Tenant User", role: "user", tenantId: "invalid-tenant" },
      platformCaller
    );

    await expect(createUserHandler(req, res)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("allows updating a tenant-scoped user when caller is platform_admin", async () => {
    const target = makeUser({ id: "user-9", role: "user", tenantId: "tenant-a", fullName: "Old Name" });
    getUserById.mockResolvedValue(target);
    updateUser.mockResolvedValue({ ...target, fullName: "New Name" });

    const { req, res, status } = makeReqRes({ id: "user-9" }, { fullName: "New Name" }, platformCaller);

    await updateUserHandler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(updateUser).toHaveBeenCalledWith("user-9", expect.objectContaining({ fullName: "New Name" }));
  });

  it("allows deleting a tenant-scoped user when caller is platform_admin", async () => {
    const target = makeUser({ id: "user-9", role: "user", tenantId: "tenant-a" });
    getUserById.mockResolvedValue(target);
    deleteUser.mockResolvedValue(true);

    const { req, res, status } = makeReqRes({ id: "user-9" }, {}, platformCaller);

    await deleteUserHandler(req, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(deleteUser).toHaveBeenCalledWith("user-9");
  });

  it("blocks deleting the last platform admin", async () => {
    const target = makeUser({ id: "pa-1", role: "platform_admin", tenantId: null });
    getUserById.mockResolvedValue(target);
    readUsers.mockResolvedValue([makeUser({ id: "pa-1", role: "platform_admin", tenantId: null })]);

    const { req, res } = makeReqRes({ id: "pa-1" }, {}, platformCaller);

    await expect(deleteUserHandler(req, res)).rejects.toMatchObject({
      status: 400,
      code: "LAST_ADMIN",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("allows deleting a platform admin when another exists", async () => {
    const target = makeUser({ id: "pa-1", role: "platform_admin", tenantId: null });
    getUserById.mockResolvedValue(target);
    readUsers.mockResolvedValue([
      makeUser({ id: "pa-1", role: "platform_admin", tenantId: null }),
      makeUser({ id: "pa-2", role: "platform_admin", tenantId: null }),
    ]);
    deleteUser.mockResolvedValue(true);

    const { req, res, status, send } = makeReqRes({ id: "pa-1" }, {}, platformCaller);

    await deleteUserHandler(req, res);

    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });

  it("ignores a role override when updating a user in the platform pool", async () => {
    const target = makeUser({ id: "pa-1", role: "platform_admin", tenantId: null, fullName: "Old Name" });
    getUserById.mockResolvedValue(target);
    updateUser.mockResolvedValue({ ...target, fullName: "New Name" });

    const { req, res, status } = makeReqRes(
      { id: "pa-1" },
      { fullName: "New Name", role: "user" },
      platformCaller
    );

    await updateUserHandler(req, res);

    expect(updateUser).toHaveBeenCalledWith(
      "pa-1",
      expect.not.objectContaining({ role: expect.anything() })
    );
    expect(status).toHaveBeenCalledWith(200);
  });
});
