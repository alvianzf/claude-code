import { Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { RoleRedirect } from "./RoleRedirect";

/**
 * Renders nested routes only when the user is NOT authenticated.
 * Redirects to the role-appropriate landing route otherwise (e.g. visiting
 * /login while logged in).
 */
export function PublicRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (user) {
    return <RoleRedirect />;
  }

  return <Outlet />;
}
