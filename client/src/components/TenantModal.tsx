import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, X } from "lucide-react";
import { createTenant, updateTenant } from "../api/tenants";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import {
  slugify,
  validateFullName,
  validatePassword,
  validateTenantName,
  validateTenantSlug,
  validateUsername,
} from "../utils/validation";
import type { TenantStatus, TenantWithEmployeeCount } from "../types";
import "./TenantModal.css";

interface TenantModalProps {
  /** When provided, the modal operates in edit mode for this tenant. Omit for create mode. */
  tenant?: TenantWithEmployeeCount;
  onClose: () => void;
  onSaved: (tenant: TenantWithEmployeeCount) => void;
}

interface FormState {
  name: string;
  slug: string;
  status: TenantStatus;
  adminUsername: string;
  adminFullName: string;
  adminPassword: string;
}

interface FormErrors {
  name?: string;
  slug?: string;
  adminUsername?: string;
  adminFullName?: string;
  adminPassword?: string;
  form?: string;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function TenantModal({ tenant, onClose, onSaved }: TenantModalProps) {
  const isEditMode = Boolean(tenant);
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();

  const [form, setForm] = useState<FormState>({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    status: tenant?.status ?? "active",
    adminUsername: "",
    adminFullName: "",
    adminPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const panelVariants = {
    hidden: prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.97, y: 8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] as const },
    },
    exit: prefersReducedMotion
      ? { opacity: 0 }
      : {
          opacity: 0,
          scale: 0.97,
          y: 8,
          transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
        },
  };

  const overlayTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

  // Close on Escape key for accessibility/keyboard navigation.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    const nameError = validateTenantName(form.name);
    if (nameError) nextErrors.name = nameError;

    const slugError = validateTenantSlug(form.slug.trim());
    if (slugError) nextErrors.slug = slugError;

    if (!isEditMode) {
      const usernameError = validateUsername(form.adminUsername);
      if (usernameError) nextErrors.adminUsername = usernameError;

      const fullNameError = validateFullName(form.adminFullName);
      if (fullNameError) nextErrors.adminFullName = fullNameError;

      const passwordError = validatePassword(form.adminPassword, true);
      if (passwordError) nextErrors.adminPassword = passwordError;
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const trimmedSlug = form.slug.trim();

    try {
      let savedTenant: TenantWithEmployeeCount;
      if (isEditMode && tenant) {
        const updated = (
          await updateTenant(tenant.id, {
            name: form.name,
            ...(trimmedSlug ? { slug: trimmedSlug } : {}),
            status: form.status,
          })
        ).tenant;
        savedTenant = { ...tenant, ...updated };
      } else {
        savedTenant = (
          await createTenant({
            name: form.name,
            ...(trimmedSlug ? { slug: trimmedSlug } : {}),
            admin: {
              username: form.adminUsername,
              fullName: form.adminFullName,
              password: form.adminPassword,
            },
          })
        ).tenant;
      }
      onSaved(savedTenant);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "SLUG_TAKEN") {
        setErrors({ slug: "This slug is already taken." });
      } else if (code === "USERNAME_TAKEN") {
        setErrors({ adminUsername: "This username is already taken." });
      } else if (code === "VALIDATION_ERROR") {
        setErrors({ form: getApiErrorMessage(err, "Please check the form for errors.") });
      } else {
        setErrors({ form: getApiErrorMessage(err) });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const slugPreview = form.slug.trim() ? null : slugify(form.name);

  return (
    <motion.div
      className="modal-overlay"
      onMouseDown={onClose}
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={overlayTransition}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            <Building2 size={20} aria-hidden="true" />
            {isEditMode ? "Edit Tenant" : "Add Tenant"}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {errors.form && (
          <div className="modal-error" role="alert">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="modal-tenant-name">Name</label>
            <input
              id="modal-tenant-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "modal-tenant-name-error" : undefined}
            />
            {errors.name && (
              <p id="modal-tenant-name-error" className="field-error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="modal-tenant-slug">
              Slug<span className="field-hint"> (auto-generated from name if left blank)</span>
            </label>
            <input
              id="modal-tenant-slug"
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              disabled={isSubmitting}
              placeholder={slugify(form.name) || "auto-generated-slug"}
              aria-invalid={Boolean(errors.slug)}
              aria-describedby={errors.slug ? "modal-tenant-slug-error" : "modal-tenant-slug-preview"}
            />
            {errors.slug ? (
              <p id="modal-tenant-slug-error" className="field-error">
                {errors.slug}
              </p>
            ) : slugPreview ? (
              <p id="modal-tenant-slug-preview" className="slug-preview">
                Will be created as <code>{slugPreview}</code>
              </p>
            ) : null}
          </div>

          {isEditMode && (
            <div className="form-field">
              <label htmlFor="modal-tenant-status">Status</label>
              <select
                id="modal-tenant-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TenantStatus }))}
                disabled={isSubmitting}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}

          {!isEditMode && (
            <>
              <h3 className="modal-section-heading">Initial Admin</h3>

              <div className="form-field">
                <label htmlFor="modal-admin-username">Username</label>
                <input
                  id="modal-admin-username"
                  type="text"
                  value={form.adminUsername}
                  onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value }))}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.adminUsername)}
                  aria-describedby={errors.adminUsername ? "modal-admin-username-error" : undefined}
                />
                {errors.adminUsername && (
                  <p id="modal-admin-username-error" className="field-error">
                    {errors.adminUsername}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="modal-admin-fullname">Full Name</label>
                <input
                  id="modal-admin-fullname"
                  type="text"
                  value={form.adminFullName}
                  onChange={(e) => setForm((f) => ({ ...f, adminFullName: e.target.value }))}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.adminFullName)}
                  aria-describedby={errors.adminFullName ? "modal-admin-fullname-error" : undefined}
                />
                {errors.adminFullName && (
                  <p id="modal-admin-fullname-error" className="field-error">
                    {errors.adminFullName}
                  </p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="modal-admin-password">Password</label>
                <input
                  id="modal-admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.adminPassword)}
                  aria-describedby={errors.adminPassword ? "modal-admin-password-error" : undefined}
                />
                {errors.adminPassword && (
                  <p id="modal-admin-password-error" className="field-error">
                    {errors.adminPassword}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
