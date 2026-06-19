import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, X } from "lucide-react";
import { apiClient } from "../api/client";
import "./LoginPage.css";

interface TenantMatch {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function SelectTenantPage() {
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchingTenants, setMatchingTenants] = useState<TenantMatch[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMatchingTenants(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const cleanInput = slugInput.trim();
    if (!cleanInput) {
      setError("Please enter a valid company workspace name or slug");
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if the tenant exists in the database
      const response = await apiClient.get(`/auth/tenant/${encodeURIComponent(cleanInput)}`);
      
      if (Array.isArray(response.data)) {
        setMatchingTenants(response.data);
      } else {
        const resolvedSlug = response.data.slug;
        localStorage.setItem("emilie_tenant_slug", resolvedSlug);
        navigate(`/${resolvedSlug}/login`);
      }
    } catch (err) {
      console.error("Tenant lookup failed:", err);
      setToastMessage(`Company workspace "${cleanInput}" could not be found.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      {toastMessage && (
        <div className="toast-container">
          <div className="toast toast-error">
            <svg className="toast-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="toast-content">{toastMessage}</div>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToastMessage(null)}
              aria-label="Close message"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {matchingTenants && (
          <div className="modal-overlay" onClick={() => setMatchingTenants(null)}>
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  <Building2 style={{ color: "var(--p-500)", marginRight: "8px" }} size={22} />
                  Select your workspace
                </h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setMatchingTenants(null)}
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "var(--space-4)" }}>
                Multiple workspaces match your entry. Please select which company you belong to:
              </p>

              <div className="workspace-option-list">
                {matchingTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    className="workspace-option-btn"
                    onClick={() => {
                      localStorage.setItem("emilie_tenant_slug", tenant.slug);
                      navigate(`/${tenant.slug}/login`);
                    }}
                  >
                    <div className="workspace-option-icon">
                      <Building2 size={20} />
                    </div>
                    <div className="workspace-option-info">
                      <span className="workspace-option-name">{tenant.name}</span>
                      <span className="workspace-option-slug">slug: {tenant.slug}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="login-card animate-in">
        <div className="brand login-brand">
          <img src="/emilie-logo.png" alt="EMILIE" className="brand-mark login-logo" />
          <div className="login-brand-text">
            <span className="brand-name">EMILIE</span>
            <span className="brand-tagline">Hormonal Health</span>
          </div>
        </div>
        <h1 className="login-title">Find your workspace</h1>
        <p className="login-subtitle">Enter your company's tenant name or slug</p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="workspace-slug">Company Slug / Name</label>
            <input
              id="workspace-slug"
              name="workspace-slug"
              type="text"
              placeholder="e.g. default"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Continue"}
          </button>

          <div style={{ marginTop: "var(--space-5)", textAlign: "center", fontSize: "13.5px" }}>
            <Link to="/login?platform=true" style={{ color: "var(--text-3)", textDecoration: "underline" }}>
              Platform Administrator? Log in here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
