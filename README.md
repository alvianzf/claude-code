# Simple User Management

A full-stack user management application with a React/TypeScript
frontend and a Node.js/Express/TypeScript backend. Data is stored in a
flat JSON file (`server/data/users.json`) — no database required.

See [`specs/`](specs/) for the full product spec, technical spec, and
implementation plan, and [`SETUP.md`](SETUP.md) for production
deployment to an Ubuntu VPS with Nginx + PM2.

---

## Features

- JWT-based authentication (login/logout, persisted session)
- Role-based access control (`admin` / `user`), enforced server-side
- Dashboard with user count, admin count, and current user info
- Admin-only user management: create, edit, delete users
- REST API documented with OpenAPI 3.0 / Swagger UI
- Default admin account auto-seeded on first run

---

## Tech Stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | React, TypeScript, Vite, React Router, Axios |
| Backend  | Node.js, Express, TypeScript |
| Auth     | JWT (jsonwebtoken), bcryptjs |
| Storage  | Flat JSON file (`server/data/users.json`) |
| API Docs | OpenAPI 3.0 + Swagger UI |

---

## Project Structure

```
.
├── client/   # React + TypeScript + Vite frontend
├── server/   # Express + TypeScript backend (REST API)
├── specs/    # Product spec, technical spec, plan, and tasks
└── SETUP.md  # Production deployment guide (Ubuntu + Nginx + PM2)
```

---

## Prerequisites

- Node.js 22.x and npm

---

## Local Development Setup

1. **Install dependencies** (npm workspaces install both `client` and
   `server`):

   ```bash
   npm install
   ```

2. **Configure the backend environment**:

   ```bash
   cp server/.env.example server/.env
   ```

   Default values work fine for local development:

   ```env
   PORT=4000
   JWT_SECRET=change-me-in-production
   JWT_EXPIRES_IN=8h
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Run both apps in development mode**:

   ```bash
   npm run dev
   ```

   This starts:
   - Backend at `http://localhost:4000` (API at `/api/v1`, docs at `/api/docs`)
   - Frontend at `http://localhost:5173` (Vite dev server, proxies `/api` to the backend)

4. **Log in** at `http://localhost:5173` with the default seeded admin:

   ```
   Username: admin
   Password: admin123
   ```

   On first run, the backend creates `server/data/users.json` seeded
   with this account. Change the password after logging in.

---

## Available Scripts

Run from the repo root:

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run backend and frontend dev servers concurrently |
| `npm run build` | Build backend (`server/dist`) and frontend (`client/dist`) |
| `npm run lint` | Lint both workspaces |
| `npm run test` | Run tests for both workspaces |

Each workspace can also be targeted individually, e.g. `npm run build -w client`.

---

## API

The backend exposes a REST API at `/api/v1`:

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/api/v1/auth/login` | — | Log in, returns a JWT |
| GET | `/api/v1/auth/me` | required | Get the current user |
| GET | `/api/v1/users` | required | List all users |
| POST | `/api/v1/users` | admin | Create a user |
| PUT | `/api/v1/users/:id` | admin | Update a user |
| DELETE | `/api/v1/users/:id` | admin | Delete a user |

Full interactive documentation is served at `/api/docs` (Swagger UI)
when the backend is running.

---

## Production Deployment

See [`SETUP.md`](SETUP.md) for step-by-step instructions to deploy to
an Ubuntu VPS using Nginx (static frontend + reverse proxy) and PM2
(backend process manager).
