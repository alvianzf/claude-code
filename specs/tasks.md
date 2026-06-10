# Tasks: User Management Application

Derived from [plan.md](./plan.md). Check off as completed.

## 0. Project Setup

- [ ] Initialize repo root with npm workspaces (`client`, `server`) or two standalone packages
- [ ] Add root scripts: `dev`, `build`, `lint`, `test`
- [ ] Add `.gitignore` (node_modules, dist, server/data/users.json, .env)
- [ ] Add `.env.example` for backend (`PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`)

## 1. Backend Foundation

- [ ] Scaffold `server/` (TypeScript + Express + ts-node-dev/tsx)
- [ ] Configure `tsconfig.json` (strict mode)
- [ ] Set up `app.ts` (Express app, JSON body parser, CORS) and `server.ts` (listen)
- [ ] Add `errorHandler` middleware mapping errors to `{ error: { code, message } }`

## 2. Data Layer

- [ ] Define `User` and `UserPublic` types
- [ ] Implement `userStore.ts`: `readUsers()`, `writeUsers()` with atomic write (temp file + rename) and write lock/queue
- [ ] Implement `seedIfEmpty()` — create `data/users.json` with default admin (`admin`/`admin123`, bcrypt-hashed) if file missing
- [ ] Handle malformed JSON file on startup (log + re-seed, no crash)

## 3. Auth Utilities & Middleware

- [ ] `password.ts`: bcrypt hash + compare (cost factor ≥ 10)
- [ ] `jwt.ts`: sign/verify JWT (`sub`, `username`, `role`, `iat`, `exp`; 8h expiry)
- [ ] `validation.ts`: username/password/fullName/role validators (spec §6)
- [ ] `requireAuth` middleware (401 on missing/invalid/expired token)
- [ ] `requireAdmin` middleware (403 if not admin)

## 4. Auth Endpoints

- [ ] `POST /api/v1/auth/login` — validate credentials, return `{ token, user }`
  - [ ] 400 on missing fields, 401 on bad credentials
- [ ] `GET /api/v1/auth/me` — return current `UserPublic`, 401 if unauthenticated

## 5. Users Endpoints

- [ ] `GET /api/v1/users` — list all users (strip `passwordHash`)
- [ ] `POST /api/v1/users` — admin only, create user
  - [ ] 400 validation, 409 username taken, 403 non-admin
- [ ] `PUT /api/v1/users/:id` — admin only, partial update
  - [ ] 404 not found, 409 username taken, 403 non-admin
- [ ] `DELETE /api/v1/users/:id` — admin only
  - [ ] 404 not found, 400 `LAST_ADMIN` guard, 403 non-admin

## 6. API Docs

- [ ] Write `openapi.yaml` covering all endpoints/schemas/error shapes
- [ ] Serve Swagger UI at `/api/docs`

## 7. Frontend Foundation

- [ ] Scaffold `client/` with `npm create vite@latest -- --template react-ts`
- [ ] Install `react-router-dom`, HTTP client (axios or fetch wrapper)
- [ ] Configure Vite dev proxy: `/api` → backend
- [ ] Define shared types: `User`, `UserPublic`, `LoginResponse`, `ApiError`

## 8. API Client & Auth Context

- [ ] API client with `Authorization: Bearer <token>` injection
- [ ] Response interceptor: on 401, clear auth state + redirect to `/login`
- [ ] `AuthContext`: holds `{ user, token }`, persists token in `localStorage`
- [ ] On app load, validate existing token via `GET /auth/me`
- [ ] `login()` / `logout()` functions in context

## 9. Routing & Pages

- [ ] `ProtectedRoute` and `PublicRoute` guards
- [ ] Route table: `/login`, `/dashboard`, default redirect
- [ ] **Login Page**: form, calls `login()`, inline error on 401/network error
- [ ] **Dashboard Page**:
  - [ ] Header with current user info + Logout button
  - [ ] Summary cards (total users, admin count)
  - [ ] User table (Username, Full Name, Role, Created At, [Actions])
  - [ ] Conditional Actions column + "Add User" button (admin only)

## 10. User Modal

- [ ] Shared create/edit modal component
- [ ] Fields: Username, Full Name, Password (optional on edit), Role
- [ ] Client-side validation mirroring spec §6
- [ ] Wire to `createUser` / `updateUser`, surface API errors (e.g., username taken)
- [ ] Cancel closes without changes

## 11. Styling & Responsiveness

- [ ] Responsive layout 320px–1440px, desktop-first
- [ ] Style Login, Dashboard, Modal, Table, Cards

## 12. Testing

- [ ] Backend unit tests: `userStore`, `validation`, `jwt`, `password`
- [ ] Backend integration tests: auth flows, RBAC enforcement, last-admin guard
- [ ] Frontend tests: LoginPage, DashboardPage, UserModal, route guards (Vitest + RTL)

## 13. Final Verification (Definition of Done)

- [ ] Login persists session across refresh
- [ ] Logout clears token
- [ ] Dashboard shows correct stats/list for both roles
- [ ] Admin CRUD works end-to-end (UI + API)
- [ ] Non-admin mutations blocked by backend (verified by test)
- [ ] Data persists in `server/data/users.json` across restarts
- [ ] Default admin seeded on first run
- [ ] Swagger UI live at `/api/docs`
