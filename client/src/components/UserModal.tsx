import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserCog, UserPlus, X } from "lucide-react";
import { createUser, updateUser } from "../api/users";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import { validateFullName, validatePassword, validateUsername } from "../utils/validation";
import type { Role, UserPublic } from "../types";
import "./UserModal.css";

interface UserModalProps {
  /** When provided, the modal operates in edit mode for this user. Omit for create mode. */
  user?: UserPublic;
  /** When set, the role is fixed to this value: the role select is hidden and not sent to the API. */
  lockRoleTo?: Role;
  onClose: () => void;
  onSaved: (user: UserPublic) => void;
}

interface FormState {
  username: string;
  fullName: string;
  password: string;
  role: Role;
}

interface FormErrors {
  username?: string;
  fullName?: string;
  password?: string;
  form?: string;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function UserModal({ user, lockRoleTo, onClose, onSaved }: UserModalProps) {
  const isEditMode = Boolean(user);
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();

  const [form, setForm] = useState<FormState>({
    username: user?.username ?? "",
    fullName: user?.fullName ?? "",
    password: "",
    role: user?.role ?? lockRoleTo ?? "user",
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

    const usernameError = validateUsername(form.username);
    if (usernameError) nextErrors.username = usernameError;

    const fullNameError = validateFullName(form.fullName);
    if (fullNameError) nextErrors.fullName = fullNameError;

    const passwordError = validatePassword(form.password, !isEditMode);
    if (passwordError) nextErrors.password = passwordError;

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

    try {
      let savedUser: UserPublic;
      if (isEditMode && user) {
        savedUser = (
          await updateUser(user.id, {
            username: form.username,
            fullName: form.fullName,
            ...(lockRoleTo ? {} : { role: form.role }),
            ...(form.password ? { password: form.password } : {}),
          })
        ).user;
      } else {
        savedUser = (
          await createUser({
            username: form.username,
            fullName: form.fullName,
            password: form.password,
            role: lockRoleTo ?? form.role,
          })
        ).user;
      }
      onSaved(savedUser);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "USERNAME_TAKEN") {
        setErrors({ username: "This username is already taken." });
      } else if (code === "VALIDATION_ERROR") {
        setErrors({ form: getApiErrorMessage(err, "Please check the form for errors.") });
      } else if (code === "LAST_ADMIN") {
        setErrors({ form: "Cannot demote the last remaining admin." });
      } else {
        setErrors({ form: getApiErrorMessage(err) });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

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
            {isEditMode ? <UserCog size={20} aria-hidden="true" /> : <UserPlus size={20} aria-hidden="true" />}
            {isEditMode ? "Edit User" : "Add User"}
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
            <label htmlFor="modal-username">Username</label>
            <input
              id="modal-username"
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? "modal-username-error" : undefined}
            />
            {errors.username && (
              <p id="modal-username-error" className="field-error">
                {errors.username}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="modal-fullname">Full Name</label>
            <input
              id="modal-fullname"
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "modal-fullname-error" : undefined}
            />
            {errors.fullName && (
              <p id="modal-fullname-error" className="field-error">
                {errors.fullName}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="modal-password">
              Password{isEditMode && <span className="field-hint"> (leave blank to keep current)</span>}
            </label>
            <input
              id="modal-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "modal-password-error" : undefined}
            />
            {errors.password && (
              <p id="modal-password-error" className="field-error">
                {errors.password}
              </p>
            )}
          </div>

          {!lockRoleTo && (
            <div className="form-field">
              <label htmlFor="modal-role">Role</label>
              <select
                id="modal-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                disabled={isSubmitting}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
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
