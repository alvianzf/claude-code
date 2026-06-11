const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

/**
 * Validates a username per spec §6: required, 3-32 chars, alphanumeric + underscore.
 * Returns an error message, or null if valid.
 */
export function validateUsername(username: string): string | null {
  if (!username) {
    return "Username is required.";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3-32 characters and contain only letters, numbers, and underscores.";
  }
  return null;
}

/**
 * Validates a password per spec §6: required on create, minimum 6 chars when provided.
 * `required` should be true in create mode and false in edit mode (blank = unchanged).
 */
export function validatePassword(password: string, required: boolean): string | null {
  if (!password) {
    return required ? "Password is required." : null;
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

/**
 * Validates a full name per spec §6: required, 1-100 chars.
 */
export function validateFullName(fullName: string): string | null {
  const trimmed = fullName.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return "Full name must be between 1 and 100 characters.";
  }
  return null;
}

const TENANT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validates a tenant name per spec §6: required, 1-100 chars.
 */
export function validateTenantName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return "Name must be between 1 and 100 characters.";
  }
  return null;
}

/**
 * Validates a tenant slug per spec §6: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3-32 chars.
 * Only validated if non-empty (an empty slug is auto-derived server-side).
 */
export function validateTenantSlug(slug: string): string | null {
  if (!slug) {
    return null;
  }
  if (slug.length < 3 || slug.length > 32 || !TENANT_SLUG_PATTERN.test(slug)) {
    return "Slug must be 3-32 characters, lowercase letters, numbers, and single hyphens between words.";
  }
  return null;
}

/**
 * Derives a slug from a tenant name: lowercase, replace runs of
 * whitespace/non `[a-z0-9]` characters with single hyphens, and strip
 * leading/trailing hyphens. Mirrors the server-side `slugify()` used for
 * auto-derivation, used here for a live preview only.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
