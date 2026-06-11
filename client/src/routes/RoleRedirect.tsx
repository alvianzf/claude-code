import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

/**
 * Redirects an authenticated user to the landing route appropriate for their role:
 * `platform_admin` -> /admin/tenants, `admin`/`user` -> /dashboard.
 *
 * Assumes the caller has already verified `user` is non-null (e.g. rendered
 * inside `ProtectedRoute`/`PublicRoute` after the loading check).
 */
export function RoleRedirect() {
  const { user } = useAuth();

  if (user?.role === "platform_admin") {
    return <Navigate to="/admin/tenants" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
