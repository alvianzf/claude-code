# Specification v3: Unified Workspace Selection & Name Matching Flow

This document details the specifications for the Unified Workspace Selection Flow and dynamic tenant resolution, extending the multi-tenant system introduced in [Specification v2](./specs-v2-multitenant.md).

## 1. Overview

To improve the login experience on all devices, the login flow begins with a Workspace Selection step. This step resolves the user's workspace/tenant by name or slug before prompting for credentials, scopes the login route, and allows users to easily clear preferences or choose between duplicate company names.

---

## 2. Requirements & User Experience

### 2.1 Workspace Selection (`/select-tenant`)
- Users accessing `/` or `/login` are automatically redirected to `/select-tenant` if no tenant slug is saved in `localStorage`.
- The user inputs their company's **slug** or **name** (e.g. `Default Tenant` or `default`).
- On submission, the client calls the backend tenant verification API.
  - If the input resolves to a **single tenant**, the client saves the slug under the `localStorage` key `emilie_tenant_slug` and redirects to `/:tenantSlug/login`.
  - If the input resolves to **multiple tenants** (i.e. name collisions), a selection modal is displayed listing the matching companies with their names and unique slugs.
  - If no tenant matches, a toast error notification is shown: `Company workspace "[input]" could not be found.`

### 2.2 Route-Based Login (`/:tenantSlug/login`)
- The login page header dynamically displays `"Sign in to [Tenant Name]"` (e.g. `"Sign in to Default Tenant"`) and changes the subtitle to `"Enter your credentials to continue"`.
- A link labeled `"Not your company?"` is rendered below the login button. Clicking it:
  - Clears `emilie_tenant_slug` from `localStorage`.
  - Redirects the user back to `/select-tenant`.

### 2.3 Platform Administrator Bypass
- Platform administrators bypass the workspace selection.
- Clicking `"Platform Administrator? Log in here"` on `/select-tenant` routes the user to `/login?platform=true`.
- The `?platform=true` query parameter instructs `/login` to bypass workspace redirection and display the global login form directly.

---

## 3. Data Flow & API Specifications

### 3.1 Verification Endpoint: `GET /api/v1/auth/tenant/:slug`

- **Description**: Public route to retrieve details of active tenants matching the provided input.
- **Parameters**: `slug` (in path) - representing the user's inputted slug or name (URL-encoded).
- **Matching Logic**:
  1. Filter all active tenants.
  2. Match case-insensitively by `tenant.slug === input`.
  3. Match case-insensitively by `tenant.name === input`.
  4. Match case-insensitively by `tenant.slug === slugify(input)`.
- **Response Schema (Single Match)**:
  - Status: `200 OK`
  - Body:
    ```json
    {
      "id": "tenant-id-uuid",
      "name": "Default Tenant",
      "slug": "default",
      "status": "active"
    }
    ```
- **Response Schema (Multiple Matches)**:
  - Status: `200 OK`
  - Body:
    ```json
    [
      {
        "id": "uuid-1",
        "name": "Acme Corp",
        "slug": "acme-corp-primary",
        "status": "active"
      },
      {
        "id": "uuid-2",
        "name": "Acme Corp",
        "slug": "acme-corp-west",
        "status": "active"
      }
    ]
    ```
- **Response Schema (No Match)**:
  - Status: `404 Not Found`
  - Body:
    ```json
    {
      "error": {
        "status": 404,
        "code": "TENANT_NOT_FOUND",
        "message": "Workspace not found"
      }
    }
    ```

---

## 4. UI Components

### 4.1 Toast Notification
- Rendered fixed at the top right of the viewport.
- Red semantic styling (`--er-bg`, `--er-strong`, border-left `--er-500`).
- Auto-dismisses after 4 seconds with support for manual closing via a close button.

### 4.2 Workspace Selection Modal
- Shown when the API returns an array (multiple matches).
- Dark overlays with glassmorphism visual style (`backdrop-filter: blur()`).
- Renders a clean card list of matches displaying:
  - Large Bold: **Company Name**
  - Small Mono/Tag: `Slug: acme-corp-primary`
- Highlights on hover, sets the local storage preference, and redirects to the selected tenant login path on click.
