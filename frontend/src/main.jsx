import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LoginPage from "./LoginPage.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import "./index.css";

function Root() {
  const { user, checking } = useAuth();

  if (checking) {
    return <div className="auth-shell"><p className="auth-checking">Loading…</p></div>;
  }

  return user ? <App /> : <LoginPage />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
