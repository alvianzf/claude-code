# Specification: User Management Application

Derived from [product.md](./product.md).

## 1. System Architecture

| Layer    | Technology                          |
| -------- | ------------------------------------ |
| Frontend | React + TypeScript (Vite)            |
| Backend  | Node.js + Express + TypeScript       |
| Storage  | Flat JSON file (`server/data/users.json`) |
| Auth     | JWT (stateless), Bearer token        |
| API Docs | OpenAPI 3.0 / Swagger UI at `/api/docs` |

The frontend is a static SPA that talks to the backend only via `/api/v1/*` JSON endpoints. CORS is restricted to the frontend's origin.

---

## 2. Data Model

### User

| Field        | Type   | Notes                                |
| ------------ | ------ | ------------------------------------- |
| id           | string | UUID v4, generated server-side        |
| username     | string | unique, case-sensitive                 |
| passwordHash | string | bcrypt hash, never sent to client      |
| fullName     | string |                                         |
| role         | enum   | `admin` \| `user`                      |
| createdAt    | string | ISO 8601 timestamp                     |
| updatedAt    | string | ISO 8601 timestamp                     |

### Storage file: `server/data/users.json`

```json
{
  "users": [ /* User[] */ ]
}
```

- The file is read fresh on every request and rewritten atomically (write to temp file then rename) on every mutation, to avoid partial writes.
- On server startup, if the file does not exist, it is created and seeded with one default admin:
  - `username: "admin"`, `password: "admin123"` (bcrypt-hashed), `role: "admin"`.

---

## 3. Authentication

### Token

- JWT signed with a server-side secret (`JWT_SECRET` env var).
- Payload: `{ sub: userId, username, role, iat, exp }`.
- Default expiry: 8 hours.

### Flow

1. Client POSTs credentials to `/api/v1/auth/login`.
2. Server verifies username + bcrypt password match.
3. On success, server returns `{ token, user }` (user without `passwordHash`).
4. Client stores `token` in `localStorage`.
5. Client attaches `Authorization: Bearer <token>` to all subsequent requests.
6. Logout: client deletes the token from `localStorage`. No server-side session to invalidate (stateless JWT).

### Middleware

- `requireAuth`: validates JWT on protected routes, returns `401` if missing/invalid/expired, attaches `req.user`.
- `requireAdmin`: runs after `requireAuth`, returns `403` if `req.user.role !== 'admin'`.

---

## 4. API Specification (`/api/v1`)

All responses are JSON. Errors follow the shape:

```json
{ "error": { "code": "STRING_CODE", "message": "Human readable message" } }
```

### 4.1 `POST /api/v1/auth/login`

- Auth: none
- Body: `{ "username": string, "password": string }`
- 200: `{ "token": string, "user": UserPublic }`
- 401: invalid credentials (`INVALID_CREDENTIALS`)
- 400: missing fields (`VALIDATION_ERROR`)

### 4.2 `GET /api/v1/auth/me`

- Auth: required
- 200: `{ "user": UserPublic }`
- 401: not authenticated

### 4.3 `GET /api/v1/users`

- Auth: required
- Returns all users (passwordHash stripped)
- 200: `{ "users": UserPublic[] }`

### 4.4 `POST /api/v1/users`

- Auth: required, admin only
- Body: `{ "username": string, "password": string, "fullName": string, "role": "admin" | "user" }`
- 201: `{ "user": UserPublic }`
- 400: validation error (missing fields, invalid role)
- 409: username already exists (`USERNAME_TAKEN`)
- 403: non-admin caller

### 4.5 `PUT /api/v1/users/:id`

- Auth: required, admin only
- Body (all optional): `{ "username"?, "password"?, "fullName"?, "role"? }`
- 200: `{ "user": UserPublic }`
- 404: user not found
- 409: username already taken by another user
- 403: non-admin caller

### 4.6 `DELETE /api/v1/users/:id`

- Auth: required, admin only
- 204: no content
- 404: user not found
- 400: cannot delete the last remaining admin (`LAST_ADMIN`)
- 403: non-admin caller

### `UserPublic` shape (returned to clients)

```json
{
  "id": "uuid",
  "username": "admin",
  "fullName": "Administrator",
  "role": "admin",
  "createdAt": "2026-06-10T00:00:00Z",
  "updatedAt": "2026-06-10T00:00:00Z"
}
```

---

## 5. Frontend Specification

### 5.1 Routing

| Path        | Page          | Access            |
| ----------- | ------------- | ----------------- |
| `/login`    | Login Page    | Public             |
| `/dashboard`| Dashboard Page| Authenticated only |

- Unauthenticated users hitting `/dashboard` are redirected to `/login`.
- Authenticated users hitting `/login` are redirected to `/dashboard`.

### 5.2 Login Page

- Fields: Username (text), Password (password).
- Submit calls `POST /auth/login`.
- On success: store token + user in client state and `localStorage`, redirect to `/dashboard`.
- On 401: display inline error "Invalid username or password".
- On network/5xx error: display generic error banner.

### 5.3 Dashboard Page

- Header: app title, current user's full name + role, Logout button.
- Summary cards: Total users count, Admin count, current logged-in user.
- User table: columns = Username, Full Name, Role, Created At, Actions.
  - Actions column (admin only): Edit, Delete.
  - "Add User" button (admin only) opens User Modal in create mode.
- Non-admin users see the table read-only with no Actions column and no "Add User" button.

### 5.4 User Modal

- Fields: Username, Full Name, Password (optional on edit — leave blank to keep current), Role (select: admin/user).
- Create mode: all fields required including password.
- Edit mode: pre-filled with existing user data; password optional.
- Save: calls `POST /users` (create) or `PUT /users/:id` (edit).
- Validation errors shown inline (e.g., username taken).
- Cancel closes modal without changes.

### 5.5 Session Handling

- On app load, if a token exists in `localStorage`, call `GET /auth/me` to validate it.
- If invalid/expired (401), clear `localStorage` and redirect to `/login`.
- All API calls attach `Authorization: Bearer <token>` via a shared API client/interceptor.
- Any `401` response from any endpoint triggers automatic logout + redirect to `/login`.

---

## 6. Validation Rules

- `username`: required, 3–32 chars, alphanumeric + underscore, unique (case-sensitive).
- `password`: required on create, minimum 6 chars when provided.
- `fullName`: required, 1–100 chars.
- `role`: must be `admin` or `user`.

---

## 7. Error Handling & Edge Cases

- Concurrent writes to `users.json` are serialized via an in-process write queue/lock to prevent corruption.
- Deleting the last admin account is rejected (`400 LAST_ADMIN`) to avoid lockout.
- Expired/invalid JWT on any protected route returns `401` and frontend forces logout.
- Malformed JSON storage file on startup: server logs an error and re-seeds with default admin (does not crash).

---

## 8. Non-Functional Requirements

- TypeScript strict mode on both frontend and backend.
- Responsive layout: usable from 320px to 1440px viewport widths.
- All authorization decisions enforced server-side; frontend role checks are UX-only.
- Passwords are hashed with bcrypt (cost factor ≥ 10) on the backend; plaintext passwords never stored or logged.

---

## 9. Visual Design System

Style: **modern SaaS dashboard** (Linear/Vercel/Stripe-inspired). Defined as CSS custom properties (design tokens) in `client/src/index.css` and reused across pages/components.

### 9.1 Color Palette

| Token | Value | Usage |
| --- | --- | --- |
| `--color-bg` | `#f6f7fb` | App background |
| `--color-surface` | `#ffffff` | Cards, modals, table |
| `--color-border` | `#e6e8f0` | Hairline borders |
| `--color-text` | `#11151f` | Primary text |
| `--color-text-muted` | `#6b7280` | Secondary/labels |
| `--gradient-primary` | `linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)` | Primary buttons, brand mark, active/highlight accents |
| `--color-accent` | `#6366f1` | Links, focus rings, icons |
| `--color-success` | `#16a34a` | Success states |
| `--color-danger` | `#dc2626` | Destructive actions (Delete) |
| `--color-admin` | `#7c3aed` | Admin role badge |
| `--color-user` | `#0ea5e9` | User role badge |

### 9.2 Typography

- Font family: `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` (loaded via `@fontsource` or system fallback if offline).
- Scale: page title `1.75rem/700`, section heading `1.125rem/600`, body `0.9375rem/400`, muted/meta `0.8125rem/500`.
- Numeric stats (summary cards) use a larger weight (`2rem/700`) for emphasis.

### 9.3 Surfaces, Spacing & Radius

- Card/modal/table surfaces: `background: var(--color-surface)`, `border-radius: 16px`, `box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.10)`.
- Spacing scale via tokens: `--space-1: 4px` through `--space-8: 48px` (4px base unit).
- Page content max-width ~1200px, centered, with responsive horizontal padding.

### 9.4 Buttons & Interactive States

- Primary button: `var(--gradient-primary)` background, white text, `border-radius: 10px`, hover = slight lift (`transform: translateY(-1px)`) + increased shadow, transition `150ms ease`.
- Secondary/ghost button: surface background, border `1px solid var(--color-border)`, hover = subtle background tint.
- Destructive button (Delete): `--color-danger` text/border, filled on hover.
- Inputs: `border-radius: 10px`, `1px solid var(--color-border)`, focus state = accent-colored ring (`box-shadow: 0 0 0 3px rgba(99,102,241,0.15)`, `border-color: var(--color-accent)`).

### 9.5 Role Badges

- Pill-shaped (`border-radius: 999px`), small uppercase label.
- `admin` → tinted purple background (`--color-admin` at low opacity) with `--color-admin` text.
- `user` → tinted blue background (`--color-user` at low opacity) with `--color-user` text.

### 9.6 Motion

- Page/card entrance: fade + slight upward slide (`opacity 0→1`, `translateY(8px→0)`, ~`300ms ease-out`), respecting `prefers-reduced-motion`.
- Modal: overlay fades in, modal panel scales/slides in (`scale(0.97)→1`, `translateY(8px)→0`, ~`200ms ease-out`).
- Table rows / cards: hover state transitions shadow/background over `150ms`.
- Buttons: hover/active transform + shadow transitions over `150ms`.

### 9.7 Layout per Page

- **Login**: centered card on a softly gradient-tinted background, brand mark using `--gradient-primary`, card uses the surface/shadow/radius tokens above.
- **Dashboard**: sticky header with brand mark + user info + Logout; summary cards in a responsive grid (3 → 2 → 1 columns) with large numeric stats and icon accents; user table inside a card with hover row highlight, role badges, and grouped action buttons.
- **User Modal**: overlay with backdrop blur, centered panel using card tokens, entrance animation per 9.6, clear field grouping and inline validation styling (red border + helper text using `--color-danger`).

---

## 10. Definition of Done

- [ ] Login issues a valid JWT and persists session across refresh.
- [ ] Logout clears client-side token.
- [ ] Dashboard shows correct stats and user list for both roles.
- [ ] Admin can create, edit, and delete users via the API and UI.
- [ ] Non-admins cannot perform mutating actions (enforced by backend, verified by tests).
- [ ] Data persists in `server/data/users.json` across server restarts.
- [ ] Default admin is seeded on first run.
- [ ] Swagger UI available at `/api/docs` documenting all endpoints.
