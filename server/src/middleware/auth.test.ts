import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { requirePlatformAdmin, requireUserManager } from "./auth.js";
import { ApiError } from "../utils/ApiError.js";
import type { JwtPayload } from "../types.js";

function makeReq(user?: JwtPayload): Request {
  return { user } as unknown as Request;
}

const res = {} as Response;
const next = vi.fn();

describe("requirePlatformAdmin", () => {
  it("allows platform_admin", () => {
    const req = makeReq({ sub: "1", username: "pa", role: "platform_admin", tenantId: null });
    expect(() => requirePlatformAdmin(req, res, next)).not.toThrow();
  });

  it("rejects admin with 403 FORBIDDEN", () => {
    const req = makeReq({ sub: "1", username: "a", role: "admin", tenantId: "t1" });
    try {
      requirePlatformAdmin(req, res, next);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("rejects user with 403 FORBIDDEN", () => {
    const req = makeReq({ sub: "1", username: "u", role: "user", tenantId: "t1" });
    expect(() => requirePlatformAdmin(req, res, next)).toThrow(ApiError);
  });
});

describe("requireUserManager", () => {
  it("allows admin", () => {
    const req = makeReq({ sub: "1", username: "a", role: "admin", tenantId: "t1" });
    expect(() => requireUserManager(req, res, next)).not.toThrow();
  });

  it("allows platform_admin", () => {
    const req = makeReq({ sub: "1", username: "pa", role: "platform_admin", tenantId: null });
    expect(() => requireUserManager(req, res, next)).not.toThrow();
  });

  it("rejects user with 403 FORBIDDEN", () => {
    const req = makeReq({ sub: "1", username: "u", role: "user", tenantId: "t1" });
    try {
      requireUserManager(req, res, next);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe("FORBIDDEN");
    }
  });
});
