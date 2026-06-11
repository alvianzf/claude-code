import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  LogOut,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import { deleteTenant, getTenants, updateTenant } from "../api/tenants";
import { getApiErrorMessage } from "../api/client";
import { TenantModal } from "../components/TenantModal";
import type { TenantWithEmployeeCount } from "../types";
import "./TenantsAdminPage.css";

export function TenantsAdminPage() {
  const { user: currentUser, logout } = useAuth();
  const [tenants, setTenants] = useState<TenantWithEmployeeCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [modalState, setModalState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; tenant: TenantWithEmployeeCount }
  >({ mode: "closed" });

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadTenants() {
    setIsLoading(true);
    try {
      const { tenants: fetchedTenants } = await getTenants();
      setTenants(fetchedTenants);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load tenants. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchTenants() {
      try {
        const { tenants: fetchedTenants } = await getTenants();
        if (!cancelled) {
          setTenants(fetchedTenants);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Failed to load tenants. Please try again."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchTenants();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalTenants = tenants.length;
  const totalEmployees = useMemo(() => tenants.reduce((sum, t) => sum + t.employeeCount, 0), [tenants]);
  const activeTenants = useMemo(() => tenants.filter((t) => t.status === "active").length, [tenants]);

  function handleSaved(savedTenant: TenantWithEmployeeCount) {
    setTenants((prev) => {
      const exists = prev.some((t) => t.id === savedTenant.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTenant.id ? savedTenant : t));
      }
      return [...prev, savedTenant];
    });
    setModalState({ mode: "closed" });
  }

  async function handleToggleStatus(tenant: TenantWithEmployeeCount) {
    setActionError(null);
    setPendingActionId(tenant.id);
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      const { tenant: updated } = await updateTenant(tenant.id, { status: nextStatus });
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, ...updated } : t)));
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to update tenant status. Please try again."));
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(tenant: TenantWithEmployeeCount) {
    setActionError(null);
    setPendingActionId(tenant.id);
    try {
      await deleteTenant(tenant.id);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to delete tenant. Please try again."));
    } finally {
      setPendingActionId(null);
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
    <div className="tenants-page">
      <header className="tenants-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Building2 size={18} />
          </span>
          <h1 className="tenants-title">Platform Admin</h1>
        </div>
        <div className="tenants-header-right">
          {currentUser && (
            <div className="current-user-info">
              <span className="current-user-name">{currentUser.fullName}</span>
              <span className="current-user-role role-badge" data-role={currentUser.role}>
                <ShieldCheck size={12} aria-hidden="true" />
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

      <motion.main className="tenants-main" initial="hidden" animate="visible" variants={pageVariants}>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}{" "}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadTenants()}>
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
              <Building2 size={14} aria-hidden="true" /> Total Tenants
            </span>
            <span className="summary-card-value">{totalTenants}</span>
          </motion.div>
          <motion.div className="summary-card" variants={listItemVariants}>
            <span className="summary-card-label">
              <Users size={14} aria-hidden="true" /> Total Employees
            </span>
            <span className="summary-card-value">{totalEmployees}</span>
          </motion.div>
          <motion.div className="summary-card" variants={listItemVariants}>
            <span className="summary-card-label">
              <CheckCircle2 size={14} aria-hidden="true" /> Active Tenants
            </span>
            <span className="summary-card-value">{activeTenants}</span>
          </motion.div>
        </motion.section>

        <section className="tenants-section">
          <div className="tenants-section-header">
            <h2>Tenants</h2>
            <button type="button" className="btn btn-primary" onClick={() => setModalState({ mode: "create" })}>
              <Plus size={16} aria-hidden="true" />
              Add Tenant
            </button>
          </div>

          {actionError && (
            <div className="alert alert-error" role="alert">
              {actionError}
            </div>
          )}

          {isLoading ? (
            <div className="tenants-loading">Loading tenants...</div>
          ) : tenants.length === 0 ? (
            <div className="tenants-empty">No tenants found.</div>
          ) : (
            <div className="tenants-table-wrapper">
              <table className="tenants-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Status</th>
                    <th scope="col">Employees</th>
                    <th scope="col">Created At</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <motion.tbody variants={listContainerVariants} initial="hidden" animate="visible">
                  {tenants.map((tenant) => {
                    const isPending = pendingActionId === tenant.id;
                    const canDelete = tenant.employeeCount === 0;
                    return (
                      <motion.tr key={tenant.id} variants={listItemVariants}>
                        <td data-label="Name">{tenant.name}</td>
                        <td data-label="Slug">{tenant.slug}</td>
                        <td data-label="Status">
                          <span className="tenant-status-badge" data-status={tenant.status}>
                            {tenant.status}
                          </span>
                        </td>
                        <td data-label="Employees">{tenant.employeeCount}</td>
                        <td data-label="Created At">{formatDate(tenant.createdAt)}</td>
                        <td data-label="Actions" className="actions-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModalState({ mode: "edit", tenant })}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => void handleToggleStatus(tenant)}
                            disabled={isPending}
                            title={tenant.status === "active" ? "Suspend tenant" : "Activate tenant"}
                            aria-label={tenant.status === "active" ? "Suspend tenant" : "Activate tenant"}
                          >
                            {tenant.status === "active" ? (
                              <PowerOff size={14} aria-hidden="true" />
                            ) : (
                              <Power size={14} aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (window.confirm(`Delete tenant "${tenant.name}"? This cannot be undone.`)) {
                                void handleDelete(tenant);
                              }
                            }}
                            disabled={isPending || !canDelete}
                            title={canDelete ? undefined : "Cannot delete a tenant with active users"}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            {isPending ? "Working..." : "Delete"}
                          </button>
                        </td>
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
          <TenantModal onClose={() => setModalState({ mode: "closed" })} onSaved={handleSaved} />
        )}
        {modalState.mode === "edit" && (
          <TenantModal
            tenant={modalState.tenant}
            onClose={() => setModalState({ mode: "closed" })}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
