# Implementation Plan: User Management Application

Derived from [specs.md](./specs.md).

## 1. Project Structure

```
simpleFE/
├── client/                 # React + TS + Vite frontend
│   ├── src/
│   │   ├── api/             # API client, axios/fetch wrapper, interceptors
│   │   ├── components/      # Reusable UI components (Modal, Table, Card, etc.)
│   │   ├── pages/            # LoginPage, DashboardPage
│   │   ├── context/          # AuthContext (token, user, login/logout)
│   │   ├── routes/            # Route guards (ProtectedRoute, PublicRoute)
│   │   ├── types/             # Shared TS types (User, ApiError, etc.)
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
├── server/                  # Node + Express + TS backend
│   ├── src/
│   │   ├── routes/            # auth.routes.ts, users.routes.ts
│   │   ├── controllers/       # auth.controller.ts, users.controller.ts
│   │   ├── middleware/        # requireAuth, requireAdmin, errorHandler
│   │   ├── services/          # userStore.ts (JSON file read/write + lock)
│   │   ├── utils/              # jwt.ts, password.ts, validation.ts
│   │   ├── docs/                # openapi.yaml / swagger setup
│   │   └── app.ts, server.ts
│   ├── data/
│   │   └── users.json          # generated/seeded at runtime (gitignored)
│   └── tsconfig.json
├── specs/
└── package.json (workspaces) or two separate package.json files
```

Use npm workspaces (or two independent packages) so `client` and `server` have isolated `package.json`/`tsconfig.json` but can be run together with one root script.

---

## 2. Backend Implementation Order

1. **Project bootstrap**
   - `server/` with TypeScript, Express, ts-node-dev (or tsx) for dev reload.
   - Env config via `.env` (`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`).

2. **User store service** (`services/userStore.ts`)
   - `readUsers()`, `writeUsers(users)` with atomic write (temp file + rename) and an in-process mutex/queue.
   - `seedIfEmpty()` — creates `data/users.json` with default admin (bcrypt-hashed `admin123`) if missing.

3. **Auth utilities** (`utils/`)
   - `password.ts`: bcrypt hash/compare helpers.
   - `jwt.ts`: sign/verify helpers using `JWT_SECRET`.
   - `validation.ts`: input validators per spec section 6.

4. **Middleware**
   - `requireAuth`: verify Bearer token, attach `req.user`, else 401.
   - `requireAdmin`: 403 if `req.user.role !== 'admin'`.
   - `errorHandler`: maps thrown errors to `{ error: { code, message } }` responses.

5. **Auth routes/controller**
   - `POST /api/v1/auth/login`
   - `GET /api/v1/auth/me`

6. **Users routes/controller**
   - `GET /api/v1/users`
   - `POST /api/v1/users` (admin)
   - `PUT /api/v1/users/:id` (admin)
   - `DELETE /api/v1/users/:id` (admin, last-admin guard)

7. **OpenAPI / Swagger**
   - `openapi.yaml` describing all endpoints + schemas.
   - Serve via `swagger-ui-express` at `/api/docs`.

8. **CORS + app wiring**
   - Configure `cors` middleware with `CORS_ORIGIN` from env.
   - Mount routers under `/api/v1`, mount Swagger at `/api/docs`.

---

## 3. Frontend Implementation Order

1. **Project bootstrap**
   - `client/` via `npm create vite@latest -- --template react-ts`.
   - Install router (`react-router-dom`) and HTTP client (`axios` or native `fetch`).

2. **Types** (`types/`)
   - `User`, `UserPublic`, `LoginResponse`, `ApiError`.

3. **API client** (`api/`)
   - Base client with `Authorization` header injection from stored token.
   - Response interceptor: on `401`, clear auth state and redirect to `/login`.
   - Functions: `login`, `getMe`, `getUsers`, `createUser`, `updateUser`, `deleteUser`.

4. **Auth context** (`context/AuthContext.tsx`)
   - Holds `{ user, token }`, persists token in `localStorage`.
   - On mount, if token exists, calls `getMe()` to validate/restore session.
   - Exposes `login()`, `logout()`.

5. **Routing** (`routes/`)
   - `ProtectedRoute` (requires auth) and `PublicRoute` (redirects if already authed).
   - Routes: `/login` → LoginPage, `/dashboard` → DashboardPage, default redirect.

6. **Login Page**
   - Form with username/password, calls `login()` from AuthContext.
   - Inline error display for 401 / network errors.

7. **Dashboard Page**
   - Fetch users on mount via `getUsers()`.
   - Header with current user + Logout.
   - Summary cards (total users, admin count).
   - User table with conditional Actions column for admins.
   - "Add User" button (admin only) → opens User Modal in create mode.

8. **User Modal component**
   - Shared for create/edit; controlled form with validation per spec section 6.
   - Calls `createUser` / `updateUser`; surfaces API validation errors (e.g., username taken).

9. **Styling**
   - Responsive CSS (flex/grid) covering 320px–1440px; desktop-first per product spec.

---

## 4. Cross-Cutting Concerns

- **Validation**: mirror rules in spec section 6 on both client (UX) and server (authoritative).
- **Error shape consistency**: frontend API client unwraps `{ error: { code, message } }` into typed errors for display.
- **Atomic file writes & locking**: single shared module (`userStore`) is the only writer to `users.json`.
- **Seed data**: only created if `users.json` is absent; never overwrite existing data.

---

## 5. Local Run / Dev Setup

- Root scripts (via npm workspaces or `concurrently`):
  - `npm run dev` → runs backend (`server`) and frontend (`client`) concurrently.
  - `npm run build` → builds both.
- Frontend dev server proxies `/api` to backend (Vite `server.proxy`) to avoid CORS issues in dev.
- `.env.example` provided for backend (`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`).

---

## 6. Testing Strategy

- **Backend**: unit tests for `userStore` (read/write/seed), `validation`, `jwt`/`password` utils; integration tests for each route (auth success/failure, RBAC enforcement, last-admin guard).
- **Frontend**: component tests for LoginPage, DashboardPage, UserModal (Vitest + React Testing Library); route guard tests for redirects.
- Manual verification against Definition of Done in `specs.md` section 9.
