# Tasks v2: Multi-Tenant Redesign

Derived from [specs-v2-multitenant.md](./specs-v2-multitenant.md). Check off as completed. v1 task list (`tasks.md`) remains untouched as historical reference.

## 0. Spec & Contract Finalization

- [x] `specs/specs-v2-multitenant.md` written and frozen (data model, roles matrix, API contract, error codes, seed data)
- [x] `specs/tasks-v2-multitenant.md` (this file) written

## 1. Shared Backend Infrastructure

- [x] Extract `server/src/services/jsonFileStore.ts`: generic `enqueue`/`writeFileAtomic`/`readFileRaw<T>` factory, used by both `userStore.ts` and `tenantStore.ts`
- [x] Update `server/src/types.ts`: `Role = "platform_admin" | "admin" | "user"`, `TenantStatus = "active" | "suspended"`, `User` gains `tenantId: string | null`, `JwtPayload` gains `tenantId: string | null`, new `Tenant` interface

## 2. Tenant Store & Seeding

- [x] New `server/src/services/tenantStore.ts`: `init`, `readTenants`, `getTenantById`, `getTenantBySlug`, `addTenant`, `updateTenant`, `deleteTenant` (using `jsonFileStore`)
- [x] `server/src/services/userStore.ts`: add `getUsersByTenant(tenantId)`, `countUsersByTenant(tenantId)`, scope `countAdmins(users, tenantId)` to a tenant
- [x] New `server/src/services/seed.ts`: `seedIfNeeded()` — seeds "Default Tenant" (`slug: "default"`, `status: "active"`) then seeds `platformadmin`/`admin123` (`role: "platform_admin"`, `tenantId: null`) and `admin`/`admin123` (`role: "admin"`, `tenantId: <default tenant id>`)
- [x] Detect old v1-shape `users.json` (no `tenantId` on first record) and trigger full reseed of both files
- [x] `server/src/server.ts`: replace `userStore.init()` with `seed.seedIfNeeded()`

## 3. Tenant Middleware

- [x] `server/src/middleware/auth.ts`: new `requirePlatformAdmin` (403 `FORBIDDEN` unless `role === "platform_admin"`)
- [x] `server/src/middleware/auth.ts`: new `requireTenantScope` (403 `NO_TENANT` if `tenantId === null`)
- [x] `server/src/routes/users.routes.ts`: add `requireTenantScope` after `requireAuth`

## 4. Tenant Endpoints

- [x] New `server/src/utils/validation.ts` additions: `validateTenantName`, `validateTenantSlug`, `validateTenantStatus`, `slugify(name)` with auto-dedup (`-2`, `-3`, ...) for auto-derived slugs
- [x] New `server/src/controllers/tenants.controller.ts`: `listTenants` (with `employeeCount`), `createTenant`, `updateTenant`, `deleteTenant` (`400 TENANT_HAS_USERS` if `employeeCount > 0`)
- [x] New `server/src/routes/tenants.routes.ts`: `requireAuth + requirePlatformAdmin`, mounted at `/api/v1/tenants`
- [x] `server/src/app.ts`: mount tenants router

## 5. User Endpoints — Tenant Scoping

- [x] `users.controller.ts` `listUsers`: scope to `req.user.tenantId` via `getUsersByTenant`
- [x] `users.controller.ts` `createUser`: force `tenantId = req.user.tenantId`; `validateRole` still only `admin|user`
- [x] `users.controller.ts` `updateUser`/`deleteUser`: 404 if target user's `tenantId !== req.user.tenantId`; per-tenant `countAdmins` for `LAST_ADMIN` guard

## 6. Auth — Suspension Check & JWT `tenantId`

- [x] `auth.controller.ts` `login`: after credential check, if `user.tenantId !== null` and tenant `status === "suspended"`, return `403 TENANT_SUSPENDED`
- [x] `signToken` payload includes `tenantId`
- [x] `me` / `toPublicUser` pass through `tenantId` (verify `serialize.ts` needs no change)

## 7. OpenAPI Updates

- [x] `server/src/docs/openapi.yaml`: `Role` enum → `[platform_admin, admin, user]`, `UserPublic.tenantId` (nullable string)
- [x] New schemas: `TenantStatus`, `Tenant`, `TenantWithEmployeeCount`, `CreateTenantRequest`, `UpdateTenantRequest`
- [x] New `/auth/login` 403 `TENANT_SUSPENDED` response
- [x] New paths: `/tenants`, `/tenants/{id}` (GET/POST/PUT/DELETE) with `400/403/404/409` responses

## 8. Frontend Dependencies

- [x] `client/package.json`: add `framer-motion`, `lucide-react`; `npm install`

## 9. Frontend Types & API Clients

- [x] `client/src/types/index.ts`: `Role`, `TenantStatus`, `Tenant`, `TenantWithEmployeeCount`, `TenantsResponse`, `TenantResponse`, `Create/UpdateTenantRequest`; `UserPublic` gains `tenantId`
- [x] New `client/src/api/tenants.ts`: `getTenants`, `createTenant`, `updateTenant`, `deleteTenant`

## 10. Frontend Routing

- [x] New `client/src/routes/RoleRedirect.tsx`: `platform_admin` → `/admin/tenants`, else → `/dashboard`
- [x] New `client/src/routes/RoleRoute.tsx`: `RoleRoute({ allow: Role[] })`, renders `<RoleRedirect/>` if role not allowed
- [x] `client/src/routes/PublicRoute.tsx`: redirect via `<RoleRedirect/>` instead of hardcoded `/dashboard`
- [x] `client/src/App.tsx`: add `/admin/tenants` (RoleRoute platform_admin) and update `/dashboard` (RoleRoute admin/user); `/` and `*` render `<RoleRedirect/>`

## 11. Platform Admin Page & TenantModal

- [x] New `client/src/pages/TenantsAdminPage.tsx` + `.css`: header, summary cards (Total Tenants/Total Employees/Active Tenants), tenant table/card-list, status badges, Add/Edit/Delete/status-toggle actions, disabled delete when `employeeCount > 0`
- [x] New `client/src/components/TenantModal.tsx` + `.css`: Name/Slug/Status fields, validation, `SLUG_TAKEN`/`VALIDATION_ERROR` handling, motion enter/exit

## 12. Dashboard Page Updates (icons/motion)

- [x] `client/src/pages/LoginPage.tsx`: handle `403 TENANT_SUSPENDED` inline error
- [x] `client/src/pages/DashboardPage.tsx`/`.css`: lucide icons (summary cards, role badges, logout, actions), framer-motion page entrance + stagger
- [x] `client/src/components/UserModal.tsx`/`.css`: `AnimatePresence`/motion enter-exit, title icons, `X` close button

## 13. Design Tokens & Shared Styles

- [x] `client/src/index.css`: `--color-status-active(-soft)`, `--color-status-suspended(-soft)`, `--color-platform(-soft)`, `.tenant-status-badge[data-status]`, `.role-badge[data-role="platform_admin"]`

## 14. Validation Mirrors

- [x] `client/src/utils/validation.ts`: `validateTenantName`, `validateTenantSlug`, `slugify` mirroring backend rules

## 15. Testing

- [x] Backend: tenant-scoped `countAdmins`, `requirePlatformAdmin`/`requireTenantScope`, suspended-tenant login rejection, last-admin-per-tenant guard, tenant delete-with-users rejection (vitest)

## 16. Final Verification (Definition of Done)

- [x] `npm run lint --workspace=server && npm run lint --workspace=client`
- [x] `npm run build --workspace=server && npm run build --workspace=client`
- [x] `npm test --workspace=server`
- [x] Manual smoke test: platform admin flow (tenant CRUD, employee counts, suspend, delete-blocked)
- [x] Manual smoke test: tenant admin/user flow (scoped users, per-tenant LAST_ADMIN, role-route redirects)
- [x] Manual smoke test: cross-tenant isolation (404 on cross-tenant ids), suspended-tenant login blocked
- [x] Manual check: motion + reduced-motion, icons, responsive 320px-1440px
- [x] All Definition of Done items in `specs-v2-multitenant.md` §12 checked
