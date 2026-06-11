import { apiClient } from "./client";
import type {
  CreateTenantRequest,
  TenantResponse,
  TenantsResponse,
  UpdateTenantRequest,
} from "../types";

export async function getTenants(): Promise<TenantsResponse> {
  const { data } = await apiClient.get<TenantsResponse>("/tenants");
  return data;
}

export async function createTenant(payload: CreateTenantRequest): Promise<TenantResponse> {
  const { data } = await apiClient.post<TenantResponse>("/tenants", payload);
  return data;
}

export async function updateTenant(id: string, payload: UpdateTenantRequest): Promise<TenantResponse> {
  const { data } = await apiClient.put<TenantResponse>(`/tenants/${id}`, payload);
  return data;
}

export async function deleteTenant(id: string): Promise<void> {
  await apiClient.delete(`/tenants/${id}`);
}
