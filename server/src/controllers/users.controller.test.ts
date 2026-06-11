import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { User } from "../types.js";

const getUserById = vi.fn();
const getUserByUsername = vi.fn();
const readUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();

vi.mock("../services/userStore.js", async () => {
  const actual = await vi.importActual<typeof import("../services/userStore.js")>(
    "../services/userStore.js"
  );
  return {
    ...actual,
    getUserById: (...args: unknown[]) => getUserById(...args),
    getUserByUsername: (...args: unknown[]) => getUserByUsername(...args),
    readUsers: (...args: unknown[]) => readUsers(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
    deleteUser: (...args: unknown[]) => deleteUser(...args),
  };
});

const { updateUser: updateUserHandler, deleteUser: deleteUserHandler } = await import(
  "./users.controller.js"
);

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

function makeReqRes(params: Record<string, string>, body: Record<string, unknown> = {}) {
  const req = {
    params,
    body,
    user: { sub: "caller", username: "caller", role: "admin", tenantId: "tenant-a" },
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
