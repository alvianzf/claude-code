import { ApiError } from "./ApiError.js";
import type { Role } from "../types.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

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

export function validateRole(role: unknown): Role {
  if (role !== "admin" && role !== "user") {
    throw new ApiError(400, "VALIDATION_ERROR", "Role must be 'admin' or 'user'");
  }
  return role;
}
