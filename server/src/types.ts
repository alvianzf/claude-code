export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type UserPublic = Omit<User, "passwordHash">;

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
