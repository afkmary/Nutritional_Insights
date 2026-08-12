import React, { useState } from "react";
import { useAuth } from "./AuthContext.jsx";

export default function DashboardExtras() {
  const { user } = useAuth();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [cleanupNote, setCleanupNote] = useState(null);

  return (
    <>
      {/* ---------------- Security & Compliance ---------------- */}
      <h2 className="section-title">Security &amp; Compliance</h2>
      <div className="card extras-card">
        <h3>Security Status</h3>
        <ul className="status-list">
          <li>
            <span className="status-label">Encryption:</span>{" "}
            <span className="status-ok">Enabled</span>
            <span className="status-detail">
              Cosmos DB service-managed AES-256, encrypted at rest
            </span>
          </li>
          <li>
            <span className="status-label">Access Control:</span>{" "}
            <span className="status-ok">Secure</span>
            <span className="status-detail">
              JWT bearer tokens; passwords stored as bcrypt hashes only
            </span>
          </li>
          <li>
            <span className="status-label">Transport:</span>{" "}
            <span className="status-ok">HTTPS</span>
            <span className="status-detail">
              TLS enforced on Static Web Apps and the Function App
            </span>
          </li>
        </ul>
      </div>

      {/* ---------------- OAuth & 2FA ---------------- */}
      <h2 className="section-title">OAuth &amp; 2FA Integration</h2>
      <div className="card extras-card">
        <h3>Secure Login</h3>

        <p className="extras-note">
          Signed in as <strong>{user.displayName}</strong> via{" "}
          <strong>{user.provider === "github" ? "GitHub OAuth" : "email and password"}</strong>.
        </p>

        <div className="oauth-row">
          <button className="btn btn-oauth" disabled title="Not configured for this project">
            Login with Google
          </button>
          <button className="btn btn-oauth" disabled title="Log out to sign in with GitHub">
            Login with GitHub
          </button>
        </div>
        <p className="extras-caption">
          GitHub is the implemented OAuth provider. Google is shown for reference
          and is not configured.
        </p>

        <label className="extras-field">
          <span>Enter 2FA Code</span>
          <input
            type="text"
            inputMode="numeric"
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            placeholder="Enter your 2FA code"
            disabled
          />
        </label>
        <p className="extras-caption">
          Two-factor authentication is not enabled on this deployment.
        </p>
      </div>

      {/* ---------------- Cloud Resource Cleanup ---------------- */}
      <h2 className="section-title">Cloud Resource Cleanup</h2>
      <div className="card extras-card">
        <p className="extras-note">
          Ensure that cloud resources are efficiently managed and cleaned up
          post-deployment.
        </p>
        <button
          className="btn btn-cleanup"
          onClick={() =>
            setCleanupNote(
              "Cleanup is performed from the Azure CLI, not the browser — deleting infrastructure needs subscription credentials that must never be shipped to a client. Run: az group delete --name diet-analysis-rg --yes"
            )
          }
        >
          Clean Up Resources
        </button>
        {cleanupNote && <p className="extras-caption">{cleanupNote}</p>}
      </div>
    </>
  );
}
