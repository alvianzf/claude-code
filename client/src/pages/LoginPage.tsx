import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/useAuth";
import { getApiErrorCode, getApiErrorMessage, apiClient } from "../api/client";
import "./LoginPage.css";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug: urlTenantSlug } = useParams<{ tenantSlug?: string }>();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantName, setTenantName] = useState<string>("");

  useEffect(() => {
    if (urlTenantSlug) {
      apiClient
        .get(`/auth/tenant/${urlTenantSlug}`)
        .then((response) => {
          setTenantName(response.data.name);
        })
        .catch((err) => {
          console.error("Failed to fetch tenant name:", err);
          setTenantName("");
        });
    } else {
      setTenantName("");
    }
  }, [urlTenantSlug]);

  const savedSlug = localStorage.getItem("emilie_tenant_slug");

  const searchParams = new URLSearchParams(window.location.search);
  const isPlatformAdminMode = searchParams.get("platform") === "true";

  // Redirect users to their saved workspace login or workspace selection
  if (!isPlatformAdminMode && !urlTenantSlug) {
    if (savedSlug) {
      return <Navigate to={`/${savedSlug}/login`} replace />;
    } else {
      return <Navigate to="/select-tenant" replace />;
    }
  }

  // Proactively save the tenantSlug in localStorage if the user directly accesses the route
  if (urlTenantSlug && urlTenantSlug !== savedSlug) {
    localStorage.setItem("emilie_tenant_slug", urlTenantSlug);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const resolvedTenantSlug = urlTenantSlug?.trim() || "";
      await login({ username, password, ...(resolvedTenantSlug ? { tenantSlug: resolvedTenantSlug } : {}) });
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "INVALID_CREDENTIALS") {
        setError("Invalid username or password");
      } else if (code === "TENANT_SUSPENDED") {
        setError("Your organization's account has been suspended. Contact your administrator.");
      } else if (axios.isAxiosError(err) && !err.response) {
        setError("Unable to reach the server. Please check your connection and try again.");
      } else if (axios.isAxiosError(err) && (err.response?.status ?? 0) >= 500) {
        setError("Something went wrong on our end. Please try again later.");
      } else {
        setError(getApiErrorMessage(err, "Unable to log in. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card animate-in">
        <div className="brand login-brand">
          <img src="/emilie-logo.png" alt="EMILIE" className="brand-mark login-logo" />
          <div className="login-brand-text">
            <span className="brand-name">EMILIE</span>
            <span className="brand-tagline">Hormonal Health</span>
          </div>
        </div>
        <h1 className="login-title">
          {tenantName ? `Sign in to ${tenantName}` : "Welcome back"}
        </h1>
        <p className="login-subtitle">
          {tenantName ? "Enter your credentials to continue" : "Sign in to your account"}
        </p>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div className="form-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {urlTenantSlug && (
          <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                localStorage.removeItem("emilie_tenant_slug");
                navigate("/select-tenant");
              }}
              style={{ textDecoration: "underline", color: "var(--p-600)" }}
            >
              Not your company?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
