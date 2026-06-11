import { createJsonFileStore } from "./jsonFileStore.js";
import type { User } from "../types.js";

interface DataFile {
  users: User[];
}

function isValidDataFile(parsed: unknown): parsed is DataFile {
  return (
    !!parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Partial<DataFile>).users)
  );
}

const store = createJsonFileStore<DataFile>(
  "users.json",
  isValidDataFile,
  // Fallback seed if the file is missing/invalid and seed.ts hasn't run yet
  // (e.g. direct store usage outside the normal startup path). The real
  // seed data (default tenant + admin accounts) is created by seed.ts.
  () => ({ users: [] })
);

export function init(): Promise<void> {
  return store.enqueue(() => store.ensureDataFile());
}

export function readUsers(): Promise<User[]> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.users;
  });
}

export function getUserById(id: string): Promise<User | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.users.find((u) => u.id === id);
  });
}

export function getUserByUsername(username: string, tenantId: string | null): Promise<User | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.users.find((u) => u.username === username && u.tenantId === tenantId);
  });
}

export function getUsersByTenant(tenantId: string | null): Promise<User[]> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.users.filter((u) => u.tenantId === tenantId);
  });
}

export function countUsersByTenant(tenantId: string | null): Promise<number> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    return data.users.filter((u) => u.tenantId === tenantId).length;
  });
}

export function addUser(user: User): Promise<User> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    data.users.push(user);
    await store.writeFileAtomic(data);
    return user;
  });
}

export function updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    const index = data.users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;

    data.users[index] = { ...data.users[index], ...updates, id: data.users[index].id };
    await store.writeFileAtomic(data);
    return data.users[index];
  });
}

export function deleteUser(id: string): Promise<boolean> {
  return store.enqueue(async () => {
    const data = await store.readFileRaw();
    const index = data.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    data.users.splice(index, 1);
    await store.writeFileAtomic(data);
    return true;
  });
}

/**
 * Counts admin-equivalent users scoped to a tenant: `role === "admin"` for a
 * regular tenant, or `role === "platform_admin"` for the platform pool
 * (`tenantId === null`).
 */
export function countAdmins(users: User[], tenantId: string | null): number {
  const role = tenantId === null ? "platform_admin" : "admin";
  return users.filter((u) => u.role === role && u.tenantId === tenantId).length;
}

/**
 * Reads the raw users.json contents (bypassing the seed-on-read check) for
 * use by seed.ts when deciding whether a reseed is needed. Returns
 * `undefined` if the file is missing or invalid JSON/shape.
 */
export async function readUsersRawUnsafe(): Promise<DataFile | undefined> {
  return store.enqueue(async () => {
    try {
      const { promises: fs } = await import("fs");
      const raw = await fs.readFile(store.filePath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidDataFile(parsed)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  });
}

/** Writes users.json directly, used by seed.ts during (re)seeding. */
export function writeUsersRaw(users: User[]): Promise<void> {
  return store.enqueue(() => store.writeFileAtomic({ users }));
}

export const usersFilePath = store.filePath;
