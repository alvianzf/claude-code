# Product Specification

## Goal

Build a full-stack web application for user management.

The application has a **React + TypeScript frontend** and a **Node.js + Express backend**.

All data is stored in a **flat JSON file** (`data/users.json`) on the server. No database required.

The frontend communicates with the backend exclusively through a **RESTful JSON API**.

---

## Features

### Authentication

Users can:

* Login (returns a JWT access token)
* Logout (token discarded client-side)
* Stay logged in via token stored in `localStorage`

Authentication is enforced on the backend — every protected route validates the JWT.

### Dashboard

Display:

* Total users
* Current user info
* Full user list

### User Management

Admin users can:

* Create users
* Edit users
* Delete users

Regular users cannot manage users.

All permission checks are enforced on the **backend**, not just the frontend.

---

## Pages

### Login Page

Fields:

* Username
* Password

Actions:

* Login

### Dashboard Page

Sections:

* Summary cards
* User table
* User management actions (admin only)

### User Modal

Fields:

* Username
* Full Name
* Password
* Role

Actions:

* Save
* Cancel

---

## Data Storage

Store all data in a JSON file at `server/data/users.json`.

The file contains an array of user objects.

User model:

* id
* username
* passwordHash
* fullName
* role
* createdAt
* updatedAt

The file is read on every request and written on every mutation. No database engine required.

A default admin account is seeded when the file does not exist.

---

## API

The backend exposes a RESTful JSON API at `/api/v1`.

All protected endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

API is documented with OpenAPI 3.0. Swagger UI is served at `/api/docs`.

---

## Visual Design

The UI should feel like a polished, modern SaaS dashboard (in the
spirit of Linear, Vercel, or Stripe's dashboard) — not a bare-bones
admin panel.

* Clean white/light-neutral surfaces with soft, layered shadows for
  cards and modals
* A vibrant accent gradient used for primary actions, branding, and
  highlights
* Polished typography with a clear hierarchy (display headings, body
  text, muted secondary text)
* Generous spacing and rounded corners (cards, buttons, inputs)
* Subtle motion: hover lift/transition on interactive elements,
  fade/slide-in transitions for the modal
* Role badges and status indicators use color to communicate meaning
  at a glance

---

## Constraints

* TypeScript required on frontend and backend
* Responsive UI (mobile-first, works at 320px → 1440px)
* All permission enforcement on the server
* JWT-based stateless authentication
* Password hashing on backend only (bcrypt)
* CORS configured for the frontend origin
* No external database — JSON file only
