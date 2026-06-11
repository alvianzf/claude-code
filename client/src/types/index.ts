export type Role = "platform_admin" | "admin" | "user";

export type TenantStatus = "active" | "suspended";

export interface UserPublic {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantWithEmployeeCount extends Tenant {
  employeeCount: number;
}

export interface TenantsResponse {
  tenants: TenantWithEmployeeCount[];
}

export interface TenantResponse {
  tenant: Tenant;
}

export interface CreateTenantAdminRequest {
  username: string;
  password: string;
  fullName: string;
}

export interface CreateTenantRequest {
  name: string;
  slug?: string;
  status?: TenantStatus;
  admin?: CreateTenantAdminRequest;
}

export interface CreateTenantResponse {
  tenant: TenantWithEmployeeCount;
  adminUser?: UserPublic;
}

export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
  status?: TenantStatus;
}

export interface LoginRequest {
  username: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  token: string;
  user: UserPublic;
}

export interface MeResponse {
  user: UserPublic;
}

export interface UsersResponse {
  users: UserPublic[];
}

export interface UserResponse {
  user: UserPublic;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  role: Role;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  fullName?: string;
  role?: Role;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
