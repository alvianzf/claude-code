import { ApiError } from "./ApiError.js";
import type { TenantStatus } from "../types.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const TENANT_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateUsername(username: unknown): string {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Username must be 3-32 characters and contain only letters, numbers, and underscores"
    );
  }
  return username;
}

export function validatePassword(password: unknown, required: boolean): string | undefined {
  if (password === undefined || password === null || password === "") {
    if (required) {
      throw new ApiError(400, "VALIDATION_ERROR", "Password is required");
    }
    return undefined;
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be at least 6 characters");
  }
  return password;
}

export function validateFullName(fullName: unknown): string {
  if (typeof fullName !== "string" || fullName.length < 1 || fullName.length > 100) {
    throw new ApiError(400, "VALIDATION_ERROR", "Full name must be 1-100 characters");
  }
  return fullName;
}

export function validateRole(role: unknown): "admin" | "user" {
  if (role !== "admin" && role !== "user") {
    throw new ApiError(400, "VALIDATION_ERROR", "Role must be 'admin' or 'user'");
  }
  return role;
}

export function validateTenantName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 100) {
    throw new ApiError(400, "VALIDATION_ERROR", "Tenant name must be 1-100 characters");
  }
  return name;
}

export function validateTenantSlug(slug: unknown): string {
  if (typeof slug !== "string" || !TENANT_SLUG_RE.test(slug) || slug.length < 3 || slug.length > 32) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Slug must be 3-32 characters, lowercase alphanumeric with single hyphens between segments"
    );
  }
  return slug;
}

export function validateTenantStatus(status: unknown): TenantStatus {
  if (status !== "active" && status !== "suspended") {
    throw new ApiError(400, "VALIDATION_ERROR", "Status must be 'active' or 'suspended'");
  }
  return status;
}

/**
 * Derives a slug from a tenant name: lowercase, replace runs of
 * non-`[a-z0-9]` characters with single hyphens, strip leading/trailing
 * hyphens. If the result collides with an existing slug, appends `-2`,
 * `-3`, etc. until unique. Throws if the base name yields an empty/invalid
 * slug after normalization.
 */
export function slugify(name: string, existingSlugs: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let candidate = base;
  if (candidate.length < 3) {
    candidate = candidate.padEnd(3, "0");
  }
  if (candidate.length > 32) {
    candidate = candidate.slice(0, 32).replace(/-+$/g, "");
  }

  if (!TENANT_SLUG_RE.test(candidate) || candidate.length < 3) {
    throw new ApiError(400, "VALIDATION_ERROR", "Could not derive a valid slug from the tenant name");
  }

  if (!existingSlugs.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (true) {
    let next = `${candidate}-${suffix}`;
    if (next.length > 32) {
      const trimLen = 32 - (`-${suffix}`.length);
      next = `${candidate.slice(0, trimLen).replace(/-+$/g, "")}-${suffix}`;
    }
    if (!existingSlugs.has(next) && TENANT_SLUG_RE.test(next)) {
      return next;
    }
    suffix += 1;
  }
}
