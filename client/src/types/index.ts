export type Role = "admin" | "user";

export interface UserPublic {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
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
