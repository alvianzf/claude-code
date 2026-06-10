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
