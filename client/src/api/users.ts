import { apiClient } from "./client";
import type {
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  MeResponse,
  UpdateUserRequest,
  UserResponse,
  UsersResponse,
} from "../types";

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", credentials);
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>("/auth/me");
  return data;
}

export async function getUsers(): Promise<UsersResponse> {
  const { data } = await apiClient.get<UsersResponse>("/users");
  return data;
}

export async function createUser(payload: CreateUserRequest): Promise<UserResponse> {
  const { data } = await apiClient.post<UserResponse>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserRequest): Promise<UserResponse> {
  const { data } = await apiClient.put<UserResponse>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
