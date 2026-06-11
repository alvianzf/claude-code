import { createJsonFileStore } from "./jsonFileStore.js";
import type { Tenant } from "../types.js";

interface DataFile {
  tenants: Tenant[];
}

function isValidDataFile(parsed: unknown): parsed is DataFile {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Partial<DataFile>).tenants)
  );
}

const store = createJsonFileStore<DataFile>(
  "tenants.json",
  isValidDataFile,
  // Fallback seed if missing/invalid and seed.ts hasn't run yet.
  () => ({ tenants: [] })
);

export function init(): Promise<void> {
  return store.enqueue(() => store.ensureDataFile());
}

export function readTenants(): Promise<Tenant[]> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.tenants;
  });
}

export function getTenantById(id: string): Promise<Tenant | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.tenants.find((t) => t.id === id);
  });
}

export function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.tenants.find((t) => t.slug === slug);
  });
}

export function addTenant(tenant: Tenant): Promise<Tenant> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    data.tenants.push(tenant);
    await store.writeFileAtomic(data);
    return tenant;
  });
}

export function updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    const index = data.tenants.findIndex((t) => t.id === id);
    if (index === -1) return undefined;

    data.tenants[index] = { ...data.tenants[index], ...updates, id: data.tenants[index].id };
    await store.writeFileAtomic(data);
    return data.tenants[index];
  });
}

export function deleteTenant(id: string): Promise<boolean> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    const index = data.tenants.findIndex((t) => t.id === id);
    if (index === -1) return false;

    data.tenants.splice(index, 1);
    await store.writeFileAtomic(data);
    return true;
  });
}

/** Writes tenants.json directly, used by seed.ts during seeding. */
export function writeTenantsRaw(tenants: Tenant[]): Promise<void> {
  return store.enqueue(() => store.writeFileAtomic({ tenants }));
}

export const tenantsFilePath = store.filePath;
