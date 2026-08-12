import React, { createContext, useContext, useEffect, useState } from "react";
import { FUNCTION_BASE_URL, setAuthToken } from "./api.js";

// Session state lives in React state, not localStorage.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const token = params.get("token");
    const oauthError = params.get("error");

    if (token || oauthError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (oauthError) {
      setChecking(false);
      return;
    }

    if (!token) {
      setChecking(false);
      return;
    }

    setAuthToken(token);
    fetch(`${FUNCTION_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setUser(data.user))
      .catch(() => setAuthToken(null))
      .finally(() => setChecking(false));
  }, []);

  function login(token, userObj) {
    setAuthToken(token);
    setUser(userObj);
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
