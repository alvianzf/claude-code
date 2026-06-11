import { apiClient } from "./client";
import type {
  CreateTenantRequest,
  CreateTenantResponse,
  TenantResponse,
  TenantsResponse,
  UpdateTenantRequest,
} from "../types";

export async function getTenants(): Promise<TenantsResponse> {
  const { data } = await apiClient.get<TenantsResponse>("/tenants");
  return data;
}

export async function createTenant(payload: CreateTenantRequest): Promise<CreateTenantResponse> {
  const { data } = await apiClient.post<CreateTenantResponse>("/tenants", payload);
  return data;
}

export async function updateTenant(id: string, payload: UpdateTenantRequest): Promise<TenantResponse> {
  const { data } = await apiClient.put<TenantResponse>(`/tenants/${id}`, payload);
  return data;
}

export async function deleteTenant(id: string): Promise<void> {
  await apiClient.delete(`/tenants/${id}`);
}
