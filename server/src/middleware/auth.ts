import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import type { JwtPayload } from "../types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
  }

  next();
}

export function requireUserManager(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin" && req.user?.role !== "platform_admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin role required");
  }
  next();
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "platform_admin") {
    throw new ApiError(403, "FORBIDDEN", "Platform admin role required");
  }
  next();
}
