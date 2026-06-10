import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/useAuth";
import { deleteUser, getUsers } from "../api/users";
import { getApiErrorMessage } from "../api/client";
import { UserModal } from "../components/UserModal";
import type { UserPublic } from "../types";
import "./DashboardPage.css";

export function DashboardPage() {
  const { user: currentUser, logout } = useAuth();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; user: UserPublic }
  >({ mode: "closed" });

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === "admin";

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
  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);

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

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">User Management</h1>
        <div className="dashboard-header-right">
          {currentUser && (
            <div className="current-user-info">
              <span className="current-user-name">{currentUser.fullName}</span>
              <span className="current-user-role role-badge" data-role={currentUser.role}>
                {currentUser.role}
              </span>
            </div>
          )}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="alert alert-error" role="alert">
            {error}{" "}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadUsers()}>
              Retry
            </button>
          </div>
        )}

        <section className="summary-cards" aria-label="Summary">
          <div className="summary-card">
            <span className="summary-card-label">Total Users</span>
            <span className="summary-card-value">{totalUsers}</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Admins</span>
            <span className="summary-card-value">{adminCount}</span>
          </div>
          <div className="summary-card">
            <span className="summary-card-label">Logged in as</span>
            <span className="summary-card-value summary-card-value-text">
              {currentUser?.fullName ?? "-"}
            </span>
            <span className="summary-card-sub">{currentUser?.username}</span>
          </div>
        </section>

        <section className="users-section">
          <div className="users-section-header">
            <h2>Users</h2>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalState({ mode: "create" })}
              >
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
                    {isAdmin && <th scope="col">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td data-label="Username">{user.username}</td>
                      <td data-label="Full Name">{user.fullName}</td>
                      <td data-label="Role">
                        <span className="role-badge" data-role={user.role}>
                          {user.role}
                        </span>
                      </td>
                      <td data-label="Created At">{formatDate(user.createdAt)}</td>
                      {isAdmin && (
                        <td data-label="Actions" className="actions-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModalState({ mode: "edit", user })}
                          >
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
                            {pendingDeleteId === user.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {modalState.mode === "create" && (
        <UserModal onClose={() => setModalState({ mode: "closed" })} onSaved={handleSaved} />
      )}
      {modalState.mode === "edit" && (
        <UserModal
          user={modalState.user}
          onClose={() => setModalState({ mode: "closed" })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
