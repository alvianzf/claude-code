import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { useAuth } from "../context/useAuth";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import "./LoginPage.css";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === "INVALID_CREDENTIALS") {
        setError("Invalid username or password");
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
      <div className="login-card">
        <h1 className="login-title">User Management</h1>
        <p className="login-subtitle">Sign in to your account</p>

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
      </div>
    </div>
  );
}
