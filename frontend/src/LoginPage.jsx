import React, { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { register, login, startGithubLogin } from "./api.js";

export default function LoginPage() {
  const { login: setSession } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are both required.");
      return;
    }
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const data = isRegister
        ? await register({ email, password, displayName })
        : await login({ email, password });
      setSession(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // No <form> element — Enter is handled explicitly so there's no page reload.
  function handleKeyDown(e) {
    if (e.key === "Enter" && !busy) handleSubmit();
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Nutritional Insights</h1>
        <p className="auth-subtitle">
          {isRegister
            ? "Create an account to explore the dashboard."
            : "Sign in to view the dashboard."}
        </p>

        {isRegister && (
          <label className="auth-field">
            <span>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Optional"
              autoComplete="name"
            />
          </label>
        )}

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRegister ? "At least 8 characters" : ""}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button
          className="btn auth-submit"
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>

        <div className="auth-divider"><span>or</span></div>

        <button className="btn auth-github" onClick={startGithubLogin} disabled={busy}>
          Continue with GitHub
        </button>

        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            className="auth-link"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError(null);
            }}
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
