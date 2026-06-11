# Specification v2: Multi-Tenant User Management Platform

This document supersedes [specs.md](./specs.md) for the multi-tenant redesign. The v1 documents (`product.md`, `specs.md`, `plan.md`, `tasks.md`) are kept as historical reference and describe the original single-tenant app; they are not updated.

## 1. System Architecture

| Layer    | Technology                          |
| -------- | ------------------------------------ |
| Frontend | React + TypeScript (Vite) + framer-motion + lucide-react |
| Backend  | Node.js + Express + TypeScript       |
| Storage  | Flat JSON files (`server/data/users.json`, `server/data/tenants.json`) |
| Auth     | JWT (stateless), Bearer token        |
| API Docs | OpenAPI 3.0 / Swagger UI at `/api/docs` |

Delta from v1: a new `tenants.json` data file is introduced. `users.json` gains a `tenantId` field. A new `platform_admin` role is introduced that is not associated with any tenant (`tenantId: null`).

---

## 2. Data Model

### Tenant

| Field      | Type   | Notes                                          |
| ---------- | ------ | ----------------------------------------------- |
| id         | string | UUID v4, generated server-side                  |
| name       | string | 1-100 chars                                     |
| slug       | string | unique, `^[a-z0-9]+(-[a-z0-9]+)*$`, 3-32 chars  |
| status     | enum   | `active` \| `suspended`                         |
| createdAt  | string | ISO 8601 timestamp                              |
| updatedAt  | string | ISO 8601 timestamp                              |

### Storage file: `server/data/tenants.json`

```json
{ "tenants": [ /* Tenant[] */ ] }
```

### User (extended)

| Field        | Type   | Notes                                  |
| ------------ | ------ | ---------------------------------------- |
| id           | string | UUID v4, generated server-side          |
| username     | string | unique, case-sensitive, **per-tenant** (and per "platform pool" — see below) |
| passwordHash | string | bcrypt hash, never sent to client       |
| fullName     | string |                                          |
| role         | enum   | `platform_admin` \| `admin` \| `user`   |
| tenantId     | string \| null | `null` only for `platform_admin`. For `admin`/`user`, references a `Tenant.id`. |
| createdAt    | string | ISO 8601 timestamp                      |
| updatedAt    | string | ISO 8601 timestamp                      |

### Storage file: `server/data/users.json`

```json
{ "users": [ /* User[] */ ] }
```

- Both files are read fresh on every request and rewritten atomically (temp file + rename) on every mutation, serialized via an in-process write queue, same pattern as v1's `userStore.ts`. The atomic-write/queue logic is extracted into a shared helper `server/src/services/jsonFileStore.ts` used by both `userStore.ts` and the new `tenantStore.ts`.
- Username uniqueness is **scoped per tenant**, with `tenantId: null` (the platform admin pool) treated as its own scope: `getUserByUsername(username, tenantId)` filters on both fields, so the same username can exist in multiple tenants and in the platform pool simultaneously. Because usernames are no longer globally unique, login requires tenant context — see §3 and §5.1.

### Slug auto-derivation

When creating a tenant without an explicit `slug`, the server derives one from `name` via `slugify()`: lowercase, replace whitespace/non-`[a-z0-9]` runs with single hyphens, strip leading/trailing hyphens. The result must still satisfy the slug regex and uniqueness check (append `-2`, `-3`, etc. on collision during auto-derivation only; an explicitly-provided colliding slug is rejected with `409 SLUG_TAKEN`).

---

## 3. Authentication

### Token

- JWT signed with `JWT_SECRET`.
- Payload: `{ sub: userId, username, role, tenantId, iat, exp }` — **`tenantId` is new**.
- Default expiry: 8 hours (unchanged).

### Flow (delta from v1)

1. Client POSTs credentials to `/api/v1/auth/login`, with an optional `tenantSlug`.
2. **Tenant resolution**: if `tenantSlug` is a non-empty (trimmed) string, the server looks up `tenantStore.getTenantBySlug(tenantSlug)`. If no tenant matches, return `401 INVALID_CREDENTIALS` immediately (an unknown slug is indistinguishable from bad credentials — no tenant-existence leak). On a match, `tenantId = tenant.id`. If `tenantSlug` is omitted/blank, `tenantId = null` (the platform admin pool).
3. Server looks up the user via `getUserByUsername(username, tenantId)` — i.e. within the resolved scope only — and verifies the bcrypt password. Either failure → `401 INVALID_CREDENTIALS` (checked before any suspension check, so suspension status is never leaked to a failed-credentials probe).
4. If a tenant was resolved (`tenantSlug` provided) and `tenant.status === "suspended"`, return `403 TENANT_SUSPENDED` and do not issue a token.
5. On success, server returns `{ token, user }` where `user` (`UserPublic`) includes `tenantId` and `role` (now possibly `platform_admin`).
6. Client stores `token` in `localStorage` (unchanged) and routes the user based on `user.role` (see §7.1).

---

## 4. Roles & Permissions Matrix

| Endpoint group              | `platform_admin` | `admin` (tenant)            | `user` (tenant)         |
| ---------------------------- | ----------------- | ----------------------------- | -------------------------- |
| `POST /auth/login`           | ✅ (no tenant check) | ✅ (blocked if tenant suspended) | ✅ (blocked if tenant suspended) |
| `GET /auth/me`                | ✅                | ✅                             | ✅                          |
| `GET /tenants`                | ✅                | ❌ 403 `FORBIDDEN`             | ❌ 403 `FORBIDDEN`          |
| `POST /tenants`               | ✅                | ❌ 403                         | ❌ 403                      |
| `PUT /tenants/:id`             | ✅                | ❌ 403                         | ❌ 403                      |
| `DELETE /tenants/:id`          | ✅                | ❌ 403                         | ❌ 403                      |
| `GET /users` (own scope)       | ✅ (platform admin pool, `tenantId: null`) | ✅ (own tenant only) | ✅ (own tenant, read-only) |
| `POST /users`                  | ✅ (platform admin pool; role forced to `platform_admin`) | ✅ (own tenant only) | ❌ 403 `FORBIDDEN` |
| `PUT /users/:id`                | ✅ (platform admin pool only, 404 cross-scope) | ✅ (own tenant only, 404 cross-tenant) | ❌ 403 `FORBIDDEN`   |
| `DELETE /users/:id`             | ✅ (platform admin pool only, 404 cross-scope) | ✅ (own tenant only, 404 cross-tenant) | ❌ 403 `FORBIDDEN`   |

Notes:
- `platform_admin` manages its own pool of users (`tenantId: null`) via `/users/*`, exactly like a tenant `admin` manages their tenant — `tenantId === null` is treated as just another scope. The `requireUserManager` middleware (replacing `requireAdmin`/`requireTenantScope`) allows both `admin` and `platform_admin` on the write endpoints; `GET /users` only requires authentication.
- `admin`/`user` cannot access `/tenants/*` at all — middleware returns `403 FORBIDDEN`.
- Cross-scope access to `/users/:id` (an id belonging to a different tenant, or to the platform pool vs. a tenant) returns `404 NOT_FOUND`, not `403`, to avoid confirming the resource's existence to another scope's admin.

---

## 5. API Specification (`/api/v1`)

All responses are JSON. Errors follow the shape:

```json
{ "error": { "code": "STRING_CODE", "message": "Human readable message" } }
```

### 5.1 `POST /api/v1/auth/login`

- Auth: none
- Body: `{ "username": string, "password": string, "tenantSlug"?: string }`
- `tenantSlug` is optional. Blank/omitted → resolves to the platform admin pool (`tenantId: null`); a slug → that tenant's users only. An unknown slug is treated the same as bad credentials.
- 200: `{ "token": string, "user": UserPublic }`
- 400: missing `username`/`password` (`VALIDATION_ERROR`)
- 401: invalid credentials, including an unrecognized `tenantSlug` (`INVALID_CREDENTIALS`)
- **403: tenant suspended (`TENANT_SUSPENDED`)** — new in v2 (only possible when `tenantSlug` resolved to a real tenant)

### 5.2 `GET /api/v1/auth/me`

- Auth: required
- 200: `{ "user": UserPublic }` (now includes `tenantId`)
- 401: not authenticated

### 5.3 `GET /api/v1/users`

- Auth: required (any role)
- Returns users belonging to `req.user.tenantId` only (passwordHash stripped) — for `platform_admin`, `tenantId` is `null`, so this returns the platform admin pool
- 200: `{ "users": UserPublic[] }`

### 5.4 `POST /api/v1/users`

- Auth: required, `requireUserManager` (`admin` or `platform_admin`)
- Body: `{ "username": string, "password": string, "fullName": string, "role": "admin" | "user" }`
- Server forces `tenantId = req.user.tenantId` on the created user (any client-supplied `tenantId` is ignored). For `platform_admin` callers (`tenantId === null`), `role` is ignored and forced to `"platform_admin"`.
- 201: `{ "user": UserPublic }`
- 400: validation error
- 409: username already taken within this tenant (or platform admin pool) (`USERNAME_TAKEN`)
- 403: non-admin, non-platform_admin caller (`FORBIDDEN`)

### 5.5 `PUT /api/v1/users/:id`

- Auth: required, `requireUserManager` (`admin` or `platform_admin`)
- Body (all optional): `{ "username"?, "password"?, "fullName"?, "role"? }`
- 404 if `:id` does not exist OR belongs to a different scope (different tenant, or tenant vs. platform pool)
- 200: `{ "user": UserPublic }`
- 409: username already taken within this tenant (or platform admin pool) by another user
- 400: `LAST_ADMIN` — cannot demote the last remaining admin **within this scope** (`admin` for a tenant, `platform_admin` for the platform pool)
- 403: non-admin, non-platform_admin caller (`FORBIDDEN`)
- For `platform_admin` callers (`tenantId === null`), `role` in the body is ignored — the platform pool's role is fixed at `platform_admin`.

### 5.6 `DELETE /api/v1/users/:id`

- Auth: required, `requireUserManager` (`admin` or `platform_admin`)
- 404 if `:id` does not exist OR belongs to a different scope (different tenant, or tenant vs. platform pool)
- 204: no content
- 400: `LAST_ADMIN` — cannot delete the last remaining admin **within this scope** (`admin` for a tenant, `platform_admin` for the platform pool)
- 403: non-admin, non-platform_admin caller (`FORBIDDEN`)

### 5.7 `GET /api/v1/tenants` — **new**

- Auth: required, `requirePlatformAdmin`
- 200: `{ "tenants": TenantWithEmployeeCount[] }`
- `TenantWithEmployeeCount` = `Tenant & { employeeCount: number }`, where `employeeCount` is the count of users (any role) with `tenantId === tenant.id`
- 403: non-platform-admin caller (`FORBIDDEN`)

### 5.8 `POST /api/v1/tenants` — **new**

- Auth: required, `requirePlatformAdmin`
- Body: `{ "name": string, "slug"?: string, "status"?: "active" | "suspended", "admin"?: { "username": string, "password": string, "fullName": string } }` (`status` defaults to `"active"`; `slug` auto-derived from `name` if omitted)
- If `admin` is provided, an initial `role: "admin"` user is created for the new tenant atomically (validated — including username uniqueness — *before* the tenant is created, so a rejected admin never leaves an orphaned tenant behind).
- 201: `{ "tenant": TenantWithEmployeeCount, "adminUser"?: UserPublic }` (`adminUser` present only if `admin` was provided; `employeeCount` is `1` in that case, else `0`)
- 400: validation error (`VALIDATION_ERROR`)
- 409: explicit slug already taken (`SLUG_TAKEN`)
- 403: non-platform-admin caller

Note: `admin.username` is **not** checked for uniqueness here — a brand-new tenant has zero users, so its initial admin's username can never collide within that tenant's scope (usernames are unique per-tenant, not globally). The same username can be reused across different tenants.

### 5.9 `PUT /api/v1/tenants/:id` — **new**

- Auth: required, `requirePlatformAdmin`
- Body (all optional): `{ "name"?, "slug"?, "status"? }`
- 200: `{ "tenant": Tenant }`
- 404: tenant not found
- 409: slug already taken by another tenant (`SLUG_TAKEN`)
- 400: validation error
- 403: non-platform-admin caller

### 5.10 `DELETE /api/v1/tenants/:id` — **new**

- Auth: required, `requirePlatformAdmin`
- 204: no content
- 404: tenant not found
- 400: tenant still has users (`TENANT_HAS_USERS`) — no cascade delete
- 403: non-platform-admin caller

### `UserPublic` shape (returned to clients)

```json
{
  "id": "uuid",
  "username": "admin",
  "fullName": "Administrator",
  "role": "admin",
  "tenantId": "uuid-or-null",
  "createdAt": "2026-06-10T00:00:00Z",
  "updatedAt": "2026-06-10T00:00:00Z"
}
```

### `Tenant` / `TenantWithEmployeeCount` shape

```json
{
  "id": "uuid",
  "name": "Default Tenant",
  "slug": "default",
  "status": "active",
  "createdAt": "2026-06-10T00:00:00Z",
  "updatedAt": "2026-06-10T00:00:00Z",
  "employeeCount": 1
}
```
(`employeeCount` only present in `GET /tenants` list responses, not in `POST`/`PUT` responses.)

---

## 6. Validation Rules

Carried over from v1, with one change:
- `username`: required, 3–32 chars, alphanumeric + underscore, unique **per-tenant** (and per platform admin pool), case-sensitive — see §2.
- `password`: required on create, minimum 6 chars when provided.
- `fullName`: required, 1–100 chars.
- `role` (user-management endpoints): must be `admin` or `user` (`platform_admin` cannot be assigned via `/users`).

New in v2:
- `tenant.name`: required, 1–100 chars (`validateTenantName`).
- `tenant.slug`: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–32 chars, globally unique (`validateTenantSlug`). Auto-derived via `slugify(name)` if omitted.
- `tenant.status`: must be `active` or `suspended`, defaults to `active` on create (`validateTenantStatus`).

---

## 7. Frontend Specification

### 7.1 Routing

| Path           | Page                | Access                                  |
| -------------- | ------------------- | ----------------------------------------- |
| `/login`       | Login Page          | Public                                    |
| `/dashboard`   | Dashboard Page (user mgmt, tenant-scoped) | `admin` \| `user` |
| `/admin/tenants` | Platform Admin — Tenants Page | `platform_admin` only |
| `/admin/team`  | Dashboard Page, reused for the platform admin pool (`tenantId: null`) | `platform_admin` only |
| `/`, `*`       | —                   | Redirect via role-aware `RoleRedirect` |

- Unauthenticated users hitting any protected route are redirected to `/login` (unchanged `ProtectedRoute`).
- Authenticated users hitting `/login` are redirected by role: `platform_admin` → `/admin/tenants`, `admin`/`user` → `/dashboard` (`PublicRoute` + `RoleRedirect`).
- A new `RoleRoute({ allow: Role[] })` guard wraps role-restricted routes; if the authenticated user's role isn't in `allow`, it renders `<RoleRedirect/>` (sends them to their correct dashboard rather than to `/login`).
- `/` and unmatched paths (`*`) render `<RoleRedirect/>`.

### 7.2 Login Page

Fields/flow from v1 (§5.2 of specs.md), plus:
- New optional **Tenant** field, placed before Username, with hint text "leave blank for platform admin". Trimmed before submit; included in the `POST /auth/login` body as `tenantSlug` only if non-empty — otherwise omitted entirely (resolves to the platform admin pool).
- New error case: `403 TENANT_SUSPENDED` → inline message "Your organization's account has been suspended. Contact your administrator."
- An unrecognized Tenant slug surfaces as the same generic `401 INVALID_CREDENTIALS` message as a bad username/password (no tenant-existence leak).

### 7.3 Dashboard Page (tenant user management)

Behavior from v1 (§5.3 of specs.md) — backend already scopes `GET /users` to the caller's tenant, so no client-side filtering changes are needed. Visual updates:
- lucide-react icons added: summary cards (`Users`, `ShieldCheck`, `UserCircle`), role badges (`Shield` for admin, `ShieldCheck` for `platform_admin`, `User` for user), header `LogOut` icon, action buttons `Plus` (Add User), `Pencil` (Edit), `Trash2` (Delete).
- framer-motion: page entrance (fade+slide, replacing/augmenting `.animate-in`), summary cards and table rows animate in with a stagger, respecting `prefers-reduced-motion` via framer-motion's `useReducedMotion()`.
- Displaying the tenant's name on this page is explicitly **out of scope** for v2 (would require a new endpoint/permission surface) — tracked as a future enhancement.

**Reused for the platform admin pool (`/admin/team`, new in v2)**: this same component renders for `platform_admin` users at `/admin/team`, scoped server-side to `tenantId: null` (their own pool of `platform_admin` users) — no separate page or component. When `currentUser.role === "platform_admin"`:
- Page title reads "Platform Team" instead of "User Management".
- The "Admins" summary card is relabeled "Platform Admins" and counts users with `role === "platform_admin"`.
- A small tab nav (`.admin-tabs`, "Tenants" / "Team", using `Link`/`useLocation` for active-state styling) is shown in the header, linking between `/admin/tenants` and `/admin/team`. The same nav is added to the Tenants Page (§7.5) so platform admins can move between the two views.
- `UserModal` is opened with `lockRoleTo="platform_admin"` (see §7.4) — new platform admins are always created with that role, and the role of existing ones cannot be changed via this UI.
- Add/Edit/Delete actions are gated by `canManage = role === "admin" || role === "platform_admin"` (replacing the old `isAdmin` check), so platform admins get the same management affordances tenant admins have.

### 7.4 User Modal

Fields/validation from v1 (§5.4 of specs.md). Visual updates:
- `AnimatePresence` + `motion` for overlay fade and panel scale/slide-in (`scale(0.97)→1`, `translateY(8px)→0`, ~200ms), matching the timing already specified in v1 §9.6.
- Icon in title (`UserPlus` create / `UserCog` edit) and an icon close button (`X`) in addition to existing overlay-click/Escape close.

New optional prop **`lockRoleTo?: Role`** (used by the platform pool view, §7.3): when set, the Role `<select>` is hidden entirely, `form.role` initializes to `lockRoleTo` (create) or `user.role` (edit), and `role` is omitted from the `createUser`/`updateUser` payload (the server forces/ignores it for the platform pool regardless).

### 7.5 Platform Admin — Tenants Page (`/admin/tenants`) — **new**

- Sticky header: brand mark with `Building2` icon + "Platform Admin" wordmark, a tab nav (`.admin-tabs`, "Tenants" / "Team", linking to `/admin/tenants` and `/admin/team` — see §7.3), current platform-admin user info (full name + `platform_admin` role badge), Logout button (`LogOut` icon).
- Summary cards (responsive grid, same pattern as Dashboard):
  - **Total Tenants** — `Building2` icon, count of all tenants.
  - **Total Employees** — `Users` icon, sum of `employeeCount` across all tenants.
  - **Active Tenants** — `CheckCircle2` icon, count of tenants with `status === "active"`.
- Tenants table (desktop) / stacked cards (<640px, same `data-label` collapse pattern as the Users table): columns = Name, Slug, Status (badge), Employees, Created At, Actions.
  - Status badge: `.tenant-status-badge[data-status="active"|"suspended"]` (green / amber).
  - Actions: Edit (`Pencil`, opens Tenant Modal in edit mode), status toggle (`Power`/`PowerOff`, calls `PUT /tenants/:id` with the opposite status), Delete (`Trash2`).
  - Delete button is disabled (with a `title` tooltip "Cannot delete a tenant with active users") when `employeeCount > 0`. If somehow clicked while stale, the `400 TENANT_HAS_USERS` response is surfaced as an alert.
- "Add Tenant" button (`Plus` icon, always visible — only `platform_admin` reaches this page) opens Tenant Modal in create mode.
- Same framer-motion page-entrance and list-stagger treatment as the Dashboard.

### 7.6 Tenant Modal — **new**

- Fields: Name (text, required), Slug (text, optional — placeholder/hint "auto-generated from name if left blank"), Status (select `active`/`suspended`, **edit mode only** — create always defaults to `active`).
- **Create mode only** — "Initial Admin" section: Username, Full Name, Password (all required). Submitted as `admin: { username, password, fullName }` on `POST /tenants`, creating the tenant's first `admin` user atomically. Not shown in edit mode.
- Client-side validation mirrors §6: `validateTenantName`, `validateTenantSlug` (only if non-empty), via new functions added to `client/src/utils/validation.ts` alongside a `slugify()` helper used for live slug preview. Initial-admin fields reuse `validateUsername`/`validatePassword`/`validateFullName`.
- Create mode: `POST /tenants`. Edit mode: `PUT /tenants/:id`.
- Error handling: `409 SLUG_TAKEN` → inline error on the Slug field. `409 USERNAME_TAKEN` → inline error on the admin Username field. `400 VALIDATION_ERROR` → form-level error banner (mirrors `UserModal` pattern).
- Same `AnimatePresence`/`motion` overlay + panel animation as User Modal.

### 7.7 Session Handling

Unchanged from v1 (§5.5 of specs.md). `UserPublic` now carries `tenantId`, which is stored in `AuthContext` as part of `user` but does not require any new context fields.

---

## 8. Design System Additions

### 8.1 Icon library

`lucide-react` — tree-shakeable (named imports only pull in used icons), no global CSS required. Icons are sized via the component's `size` prop (e.g., `size={16}` inline with text, `size={20}`/`24` for header/card accents), inheriting `currentColor` for theming.

Icon usage map:

| Context                          | Icon(s)                          |
| --------------------------------- | ----------------------------------- |
| App/brand mark (tenant dashboard)  | `Users` (replacing the "U" letter mark, optional) |
| App/brand mark (platform admin)    | `Building2`                        |
| Logout button                      | `LogOut`                            |
| Summary card: total users          | `Users`                              |
| Summary card: admins                | `ShieldCheck`                        |
| Summary card: current user          | `UserCircle`                         |
| Summary card: total tenants         | `Building2`                          |
| Summary card: total employees       | `Users`                              |
| Summary card: active tenants        | `CheckCircle2`                       |
| Role badge: admin                   | `Shield`                              |
| Role badge: user                    | `User`                                |
| Role badge: platform_admin          | `ShieldCheck` (or `Crown`)            |
| Add User / Add Tenant button        | `Plus`                                |
| Edit action                         | `Pencil`                              |
| Delete action                       | `Trash2`                              |
| Tenant status toggle (active→suspend) | `PowerOff`                          |
| Tenant status toggle (suspended→active) | `Power`                            |
| Modal close button                  | `X`                                   |
| User Modal title (create/edit)       | `UserPlus` / `UserCog`                |

### 8.2 Motion (framer-motion)

- Page entrance: `motion.div` with `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}` — mirrors the existing `.animate-in` keyframe (`fade-in-up`, 300ms, `--ease-out`).
- List stagger (summary cards, table rows, tenant rows): parent `motion.div`/`motion.tbody` with `variants={{ visible: { transition: { staggerChildren: 0.05 } } }}`, children use the page-entrance variant.
- Modal: `AnimatePresence` wraps the conditionally-rendered modal; overlay fades (`opacity 0→1`), panel scales/slides (`scale: 0.97→1`, `y: 8→0`, ~200ms), matching v1 §9.6 timings exactly. Exit transitions reverse these.
- All variants check `useReducedMotion()` (framer-motion hook) and collapse durations to `0` / skip transform offsets when `true`, in addition to the existing global `prefers-reduced-motion` CSS block in `index.css`.

### 8.3 New design tokens (`client/src/index.css`)

| Token | Value | Usage |
| --- | --- | --- |
| `--color-status-active` | `var(--color-success)` (`#16a34a`) | Tenant status badge (active) |
| `--color-status-active-soft` | `#dcfce7` | Tenant status badge background (active) |
| `--color-status-suspended` | `#d97706` | Tenant status badge (suspended) |
| `--color-status-suspended-soft` | `#fef3c7` | Tenant status badge background (suspended) |
| `--color-platform` | `#0f172a` | `platform_admin` role badge text |
| `--color-platform-soft` | `#e2e8f0` | `platform_admin` role badge background |

New CSS rules: `.tenant-status-badge[data-status="active"|"suspended"]` (pill, same shape as `.role-badge`), `.role-badge[data-role="platform_admin"]`.

---

## 9. Migration & Seeding

### Seed data (clean start)

On startup, `server/src/services/seed.ts` runs `seedIfNeeded()`:

1. If `server/data/tenants.json` is missing/invalid, create it with one tenant:
   - `name: "Default Tenant"`, `slug: "default"`, `status: "active"`.
2. If `server/data/users.json` is missing/invalid **or** any existing user record lacks a `tenantId` key (old v1 shape), fully reseed `users.json` with two users:
   - `username: "platformadmin"`, `password: "admin123"` (bcrypt), `fullName: "Platform Administrator"`, `role: "platform_admin"`, `tenantId: null`.
   - `username: "admin"`, `password: "admin123"` (bcrypt), `fullName: "Administrator"`, `role: "admin"`, `tenantId: <Default Tenant id>`.

### Migration rationale

`server/data/` is gitignored (runtime-only). Detecting the old v1 shape (no `tenantId` field on the first user record) and triggering a full reseed of `users.json` (and ensuring `tenants.json` exists) is simpler and safer than partial in-place migration, which could otherwise produce ambiguous role/tenant combinations. This mirrors v1's existing "malformed JSON → re-seed" behavior (specs.md §7), just with an additional shape check.

---

## 10. Error Handling & Edge Cases

Carried over from v1 (§7 of specs.md): concurrent writes serialized via write queue, expired/invalid JWT → `401` + forced logout, malformed JSON → re-seed without crashing.

New in v2:
- Deleting/demoting the last admin within a scope is rejected (`400 LAST_ADMIN`), scoped per-tenant for `admin`, and per-platform-pool for `platform_admin` (does not consider admins in other tenants or the other pool).
- An `admin`/`user` calling any `/tenants/*` endpoint receives `403 FORBIDDEN`.
- `PUT`/`DELETE /users/:id` for an id belonging to a different scope (different tenant, or tenant vs. platform pool) returns `404 NOT_FOUND` (not `403`), to avoid confirming cross-scope resource existence.
- Username collisions are scoped per-tenant/per-pool (`409 USERNAME_TAKEN`) — the same username may exist in multiple tenants and in the platform admin pool simultaneously. Login disambiguates via the optional `tenantSlug` (§3, §5.1); an unrecognized slug returns `401 INVALID_CREDENTIALS`.
- `DELETE /tenants/:id` for a tenant with `employeeCount > 0` returns `400 TENANT_HAS_USERS`; no cascading delete is implemented.
- Login for a user whose tenant is `suspended` returns `403 TENANT_SUSPENDED` (checked only after credentials are verified).
- Tenant slug collisions return `409 SLUG_TAKEN` (only for explicitly-provided slugs; auto-derived slugs are de-duplicated server-side by appending `-2`, `-3`, etc.).

---

## 11. Non-Functional Requirements

Carried over from v1 (§8 of specs.md): TypeScript strict mode both sides, responsive 320px–1440px, all authorization enforced server-side, bcrypt cost ≥ 10.

New in v2:
- New frontend dependencies (`framer-motion`, `lucide-react`) are the only additions — both are tree-shakeable and widely used in production SaaS UIs; no other UI/animation/icon libraries are introduced, keeping the bundle lean.
- All new animations must respect `prefers-reduced-motion` (both via framer-motion's `useReducedMotion()` and the existing global CSS media query).

---

## 12. Definition of Done

- [x] Platform admin (`platformadmin`/`admin123`) logs in and is redirected to `/admin/tenants`.
- [x] Platform admin can view tenants with accurate `employeeCount`, create/edit/delete tenants, and toggle `active`/`suspended` status.
- [x] Deleting a tenant with `employeeCount > 0` is blocked (`400 TENANT_HAS_USERS`), reflected in disabled UI state.
- [x] Tenant slug uniqueness enforced (`409 SLUG_TAKEN`), auto-derivation works when slug omitted.
- [x] Tenant admin (`admin`/`admin123`) logs in (with Tenant slug `default`) and is redirected to `/dashboard`, sees only their tenant's users.
- [x] `admin`/`user` cannot reach `/tenants/*` (403 `FORBIDDEN`) or `/admin/tenants`/`/admin/team` (redirected client-side).
- [x] Cross-scope `PUT`/`DELETE /users/:id` (different tenant, or tenant vs. platform pool) returns `404`.
- [x] `LAST_ADMIN` guard enforced independently per scope (each tenant, and the platform admin pool).
- [x] Suspending a tenant blocks login for its users with `403 TENANT_SUSPENDED` and a clear inline message.
- [x] Username uniqueness is per-tenant/per-pool; the same username can be reused across tenants. Login form has an optional Tenant field (blank = platform admin pool); an unrecognized slug returns `401 INVALID_CREDENTIALS`.
- [x] `platform_admin` manages its own pool of `platform_admin` users at `/admin/team` (reusing the Dashboard + UserModal with `lockRoleTo`), with the same `LAST_ADMIN` protection as tenant admins.
- [x] `POST /tenants` no longer returns `409 USERNAME_TAKEN` — a new tenant's initial admin username can never collide.
- [x] framer-motion page/list/modal animations present and respect `prefers-reduced-motion`.
- [x] lucide-react icons used per §8.1 icon map.
- [x] Both dashboards responsive 320px–1440px (table→card collapse intact).
- [x] `server/data/users.json` and `tenants.json` seed correctly on a clean start; old-shape `users.json` triggers a full reseed without crashing.
- [x] Swagger UI (`/api/docs`) documents all `/tenants/*` endpoints and updated `/users`/`/auth` error codes.
- [x] v1 spec files (`product.md`, `specs.md`, `plan.md`, `tasks.md`) remain unmodified.
