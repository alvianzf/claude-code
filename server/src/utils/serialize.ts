import type { User, UserPublic } from "../types.js";

export function toPublicUser(user: User): UserPublic {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
