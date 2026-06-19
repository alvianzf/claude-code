import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { slugify } from "../utils/validation";
import "./LoginPage.css";

export function SelectTenantPage() {
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanSlug = slugify(slugInput);
    if (!cleanSlug) {
      setError("Please enter a valid company workspace name or slug");
      return;
    }

    // Save to local storage
    localStorage.setItem("emilie_tenant_slug", cleanSlug);

    // Redirect to the tenant-specific login page
    navigate(`/${cleanSlug}/login`);
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
            />
          </div>

          <button type="submit" className="btn btn-primary login-submit">
            Continue
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
