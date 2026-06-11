import { Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { Role } from "../types";
import { RoleRedirect } from "./RoleRedirect";

interface RoleRouteProps {
  /** Roles permitted to access the nested routes. */
  allow: Role[];
}

/**
 * Guards nested routes by role. Assumes the user is already authenticated
 * (i.e. nested inside `ProtectedRoute`). If the current user's role isn't in
 * `allow`, redirects them to the section appropriate for their role rather
 * than to /login.
 */
export function RoleRoute({ allow }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user || !allow.includes(user.role)) {
    return <RoleRedirect />;
  }

  return <Outlet />;
}
