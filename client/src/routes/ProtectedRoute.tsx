import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";

/**
 * Renders nested routes only when the user is authenticated.
 * Redirects to the appropriate login page otherwise. Shows nothing while the initial
 * session check is in progress to avoid a flash of the login page.
 */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();

  if (isLoading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user) {
    const loginPath = tenantSlug ? `/${tenantSlug}/login` : "/login";
    return <Navigate to={loginPath} replace />;
  }

  return <Outlet />;
}
