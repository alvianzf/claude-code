import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import {
  Building2,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCircle,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import { deleteUser, getUsers } from "../api/users";
import { getApiErrorMessage } from "../api/client";
import { UserModal } from "../components/UserModal";
import type { UserPublic } from "../types";
import "./DashboardPage.css";

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: Shield,
  platform_admin: ShieldCheck,
  user: User,
};

export function DashboardPage() {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [modalState, setModalState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; user: UserPublic }
  >({ mode: "closed" });

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isPlatformAdmin = currentUser?.role === "platform_admin";
  const canManage = currentUser?.role === "admin" || isPlatformAdmin;
  const location = useLocation();

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { users: fetchedUsers } = await getUsers();
      setUsers(fetchedUsers);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load users. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        const { users: fetchedUsers } = await getUsers();
        if (!cancelled) {
          setUsers(fetchedUsers);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load users. Please try again."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalUsers = users.length;
  const adminRole = isPlatformAdmin ? "platform_admin" : "admin";
  const adminCount = useMemo(() => users.filter((u) => u.role === adminRole).length, [users, adminRole]);

  function handleSaved(savedUser: UserPublic) {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === savedUser.id);
      if (exists) {
        return prev.map((u) => (u.id === savedUser.id ? savedUser : u));
      }
      return [...prev, savedUser];
    });
    setModalState({ mode: "closed" });
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    setPendingDeleteId(id);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, "Failed to delete user. Please try again."));
    } finally {
      setPendingDeleteId(null);
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const pageVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  const listContainerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 },
    },
  };

  const listItemVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Users size={18} />
          </span>
          <h1 className="dashboard-title">{isPlatformAdmin ? "Platform Team" : "User Management"}</h1>
        </div>
        {isPlatformAdmin && (
          <nav className="admin-tabs" aria-label="Platform admin sections">
            <Link
              to="/admin/tenants"
              className={`admin-tab ${location.pathname === "/admin/tenants" ? "active" : ""}`}
            >
              <Building2 size={14} aria-hidden="true" />
              Tenants
            </Link>
            <Link to="/admin/team" className={`admin-tab ${location.pathname === "/admin/team" ? "active" : ""}`}>
              <Users size={14} aria-hidden="true" />
              Team
            </Link>
          </nav>
        )}
        <div className="dashboard-header-right">
          {currentUser && (
            <div className="current-user-info">
              <span className="current-user-name">{currentUser.fullName}</span>
              <span className="current-user-role role-badge" data-role={currentUser.role}>
                {(() => {
                  const RoleIcon = ROLE_ICONS[currentUser.role];
                  return RoleIcon ? <RoleIcon size={12} aria-hidden="true" /> : null;
                })()}
                {currentUser.role}
              </span>
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      </header>

      <motion.main
        className="dashboard-main"
        initial="hidden"
        animate="visible"
        variants={pageVariants}
      >
        {error && (
          <div className="alert alert-error" role="alert">
            {error}{" "}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadUsers()}>
              Retry
            </button>
          </div>
        )}

        <motion.section
          className="summary-cards"
          aria-label="Summary"
          variants={listContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="summary-card" variants={listItemVariants}>
            <span className="summary-card-label">
              <Users size={14} aria-hidden="true" /> Total Users
            </span>
            <span className="summary-card-value">{totalUsers}</span>
          </motion.div>
          <motion.div className="summary-card" variants={listItemVariants}>
            <span className="summary-card-label">
              <ShieldCheck size={14} aria-hidden="true" /> {isPlatformAdmin ? "Platform Admins" : "Admins"}
            </span>
            <span className="summary-card-value">{adminCount}</span>
          </motion.div>
          <motion.div className="summary-card" variants={listItemVariants}>
            <span className="summary-card-label">
              <UserCircle size={14} aria-hidden="true" /> Logged in as
            </span>
            <span className="summary-card-value summary-card-value-text">
              {currentUser?.fullName ?? "-"}
            </span>
            <span className="summary-card-sub">{currentUser?.username}</span>
          </motion.div>
        </motion.section>

        <section className="users-section">
          <div className="users-section-header">
            <h2>Users</h2>
            {canManage && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalState({ mode: "create" })}
              >
                <Plus size={16} aria-hidden="true" />
                Add User
              </button>
            )}
          </div>

          {deleteError && (
            <div className="alert alert-error" role="alert">
              {deleteError}
            </div>
          )}

          {isLoading ? (
            <div className="users-loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="users-empty">No users found.</div>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Full Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Created At</th>
                    {canManage && <th scope="col">Actions</th>}
                  </tr>
                </thead>
                <motion.tbody variants={listContainerVariants} initial="hidden" animate="visible">
                  {users.map((user) => {
                    const RoleIcon = ROLE_ICONS[user.role];
                    return (
                      <motion.tr key={user.id} variants={listItemVariants}>
                        <td data-label="Username">{user.username}</td>
                        <td data-label="Full Name">{user.fullName}</td>
                        <td data-label="Role">
                          <span className="role-badge" data-role={user.role}>
                            {RoleIcon ? <RoleIcon size={12} aria-hidden="true" /> : null}
                            {user.role}
                          </span>
                        </td>
                        <td data-label="Created At">{formatDate(user.createdAt)}</td>
                        {canManage && (
                          <td data-label="Actions" className="actions-cell">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setModalState({ mode: "edit", user })}
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
                                  void handleDelete(user.id);
                                }
                              }}
                              disabled={pendingDeleteId === user.id}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              {pendingDeleteId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          )}
        </section>
      </motion.main>

      <AnimatePresence>
        {modalState.mode === "create" && (
          <UserModal
            lockRoleTo={isPlatformAdmin ? "platform_admin" : undefined}
            onClose={() => setModalState({ mode: "closed" })}
            onSaved={handleSaved}
          />
        )}
        {modalState.mode === "edit" && (
          <UserModal
            user={modalState.user}
            lockRoleTo={isPlatformAdmin ? "platform_admin" : undefined}
            onClose={() => setModalState({ mode: "closed" })}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
