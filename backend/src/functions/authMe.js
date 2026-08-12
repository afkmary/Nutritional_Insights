const { app } = require("@azure/functions");
const { verifyRequest, json } = require("../../shared/auth");

// GET /api/auth/me   (Authorization: Bearer <token>)
//
// The React app calls this on page load with whatever token it holds.
// 200 -> render the dashboard.  401 -> render the login screen.

app.http("AuthMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: async (request) => {
    const claims = verifyRequest(request);
    if (!claims) return json(401, { error: "Not authenticated." });

    return json(200, {
      user: {
        email: claims.email,
        displayName: claims.name,
        provider: claims.provider
      }
    });
  }
});
