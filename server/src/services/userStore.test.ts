import { describe, it, expect } from "vitest";
import { countAdmins } from "./userStore.js";
import type { User } from "../types.js";

function makeUser(overrides: Partial<User>): User {
  return {
    id: overrides.id ?? "id",
    username: overrides.username ?? "user",
    passwordHash: "hash",
    fullName: "Full Name",
    role: overrides.role ?? "user",
    tenantId: overrides.tenantId ?? null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("countAdmins", () => {
  const tenantA = "tenant-a";
  const tenantB = "tenant-b";

  it("counts only admins within the given tenant", () => {
    const users: User[] = [
      makeUser({ id: "1", role: "admin", tenantId: tenantA }),
      makeUser({ id: "2", role: "admin", tenantId: tenantA }),
      makeUser({ id: "3", role: "user", tenantId: tenantA }),
      makeUser({ id: "4", role: "admin", tenantId: tenantB }),
      makeUser({ id: "5", role: "platform_admin", tenantId: null }),
    ];

    expect(countAdmins(users, tenantA)).toBe(2);
    expect(countAdmins(users, tenantB)).toBe(1);
  });

  it("does not count platform_admin (tenantId: null) toward any tenant", () => {
    const users: User[] = [makeUser({ id: "1", role: "platform_admin", tenantId: null })];
    expect(countAdmins(users, tenantA)).toBe(0);
  });

  it("returns 0 for a tenant with no admins", () => {
    const users: User[] = [makeUser({ id: "1", role: "user", tenantId: tenantA })];
    expect(countAdmins(users, tenantA)).toBe(0);
  });
});
