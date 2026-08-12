const jwt = require("jsonwebtoken");

const TOKEN_TTL = "2h";

/**
 * Both the email/password path and the GitHub OAuth path call this, so the
 * React app only ever deals with one kind of session token.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email || null,
      name: user.displayName,
      provider: user.provider
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

/**
 * Reads "Authorization: Bearer <token>" off the request and verifies it.
 * Returns the decoded claims, or null if missing / invalid / expired.
 */
function verifyRequest(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(request) {
  const claims = verifyRequest(request);
  if (!claims) {
    return { status: 401, jsonBody: { error: "Authentication required." } };
  }
  return null;
}

/** Small helper so handlers stay readable. */
function json(status, body) {
  return { status, jsonBody: body };
}

/** Never let the password hash reach the client. */
function publicUser(user) {
  return {
    email: user.email || null,
    displayName: user.displayName,
    provider: user.provider
  };
}

module.exports = {
  signToken,
  verifyRequest,
  requireAuth,
  json,
  publicUser,
  TOKEN_TTL
};
