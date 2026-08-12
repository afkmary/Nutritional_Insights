const { app } = require("@azure/functions");
const crypto = require("crypto");

app.http("AuthGithubStart", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github/start",
  handler: async (request, context) => {
    if (!process.env.GITHUB_CLIENT_ID) {
      context.error("GITHUB_CLIENT_ID is not set.");
      return { status: 500, jsonBody: { error: "OAuth is not configured." } };
    }

    const state = crypto.randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.API_BASE_URL}/api/auth/github/callback`,
      scope: "read:user user:email",
      state,
      allow_signup: "true"
    });

    return {
      status: 302,
      headers: {
        Location: `https://github.com/login/oauth/authorize?${params}`,
        "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      }
    };
  }
});
