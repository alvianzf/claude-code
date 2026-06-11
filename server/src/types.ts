export type Role = "platform_admin" | "admin" | "user";

export type TenantStatus = "active" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UserPublic = Omit<User, "passwordHash">;

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  tenantId: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
