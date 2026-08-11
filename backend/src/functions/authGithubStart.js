const { app } = require("@azure/functions");
const crypto = require("crypto");

// GET /api/auth/github/start
//
// Step 1 of the OAuth authorization-code flow. The browser hits this URL and
// we bounce it to GitHub's consent screen.
//
// The random `state` value goes into an HttpOnly cookie and is echoed back by
// GitHub in step 2. Comparing them is what stops an attacker from replaying a
// stolen callback URL — worth saying out loud in the video.

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
