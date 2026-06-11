import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import * as tenantStore from "./tenantStore.js";
import * as userStore from "./userStore.js";
import { hashPassword } from "../utils/password.js";
import type { Tenant, User } from "../types.js";

interface UsersDataFile {
  users: User[];
}

interface TenantsDataFile {
  tenants: Tenant[];
}

function isValidTenantsFile(parsed: unknown): parsed is TenantsDataFile {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Partial<TenantsDataFile>).tenants)
  );
}

function isValidUsersFile(parsed: unknown): parsed is UsersDataFile {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Partial<UsersDataFile>).users)
  );
}

/** True if the parsed users.json is the old v1 shape (users lack `tenantId`). */
function isLegacyUsersShape(data: UsersDataFile): boolean {
  if (data.users.length === 0) return false;
  return !("tenantId" in data.users[0]);
}

async function readJsonIfExists<T>(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Seeds `tenants.json` and `users.json` on a clean start, or fully reseeds
 * `users.json` (and ensures `tenants.json` exists) if the existing
 * `users.json` is the old v1 shape (records without `tenantId`) or missing.
 *
 * Reads the raw files directly (before any fallback file creation) so that
 * "missing/invalid" can be distinguished from "valid but empty".
 */
export async function seedIfNeeded(): Promise<void> {
  await fs.mkdir(path.dirname(tenantStore.tenantsFilePath), { recursive: true });

  const now = new Date().toISOString();

  // Ensure tenants.json exists and has a Default Tenant.
  const tenantsRaw = await readJsonIfExists<TenantsDataFile>(tenantStore.tenantsFilePath);
  const tenantsFileValid = tenantsRaw !== undefined && isValidTenantsFile(tenantsRaw);
  let tenants: Tenant[] = tenantsFileValid ? (tenantsRaw as TenantsDataFile).tenants : [];

  let defaultTenant = tenants.find((t) => t.slug === "default");
  let tenantsChanged = !tenantsFileValid;
  if (!defaultTenant) {
    defaultTenant = {
      id: uuidv4(),
      name: "Default Tenant",
      slug: "default",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    tenants = [...tenants, defaultTenant];
    tenantsChanged = true;
  }
  if (tenantsChanged) {
    await tenantStore.writeTenantsRaw(tenants);
  }

  const usersRaw = await readJsonIfExists<UsersDataFile>(userStore.usersFilePath);
  const usersValid = usersRaw !== undefined && isValidUsersFile(usersRaw);
  const needsUserReseed = !usersValid || isLegacyUsersShape(usersRaw as UsersDataFile);

  if (needsUserReseed) {
    const platformAdmin: User = {
      id: uuidv4(),
      username: "platformadmin",
      passwordHash: await hashPassword("admin123"),
      fullName: "Platform Administrator",
      role: "platform_admin",
      tenantId: null,
      createdAt: now,
      updatedAt: now,
    };

    const tenantAdmin: User = {
      id: uuidv4(),
      username: "admin",
      passwordHash: await hashPassword("admin123"),
      fullName: "Administrator",
      role: "admin",
      tenantId: defaultTenant.id,
      createdAt: now,
      updatedAt: now,
    };

    await userStore.writeUsersRaw([platformAdmin, tenantAdmin]);
  }
}
