const { app } = require("@azure/functions");
const { getUsersContainer, findUserById } = require("../../shared/cosmos");
const { signToken } = require("../../shared/auth");

function redirectToApp(fragment) {
  return {
    status: 302,
    headers: {
      Location: `${process.env.APP_BASE_URL}/auth/callback#${fragment}`,
      "Set-Cookie":
        "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    }
  };
}

app.http("AuthGithubCallback", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github/callback",
  handler: async (request, context) => {
    try {
      const code = request.query.get("code");
      const state = request.query.get("state");

      const cookies = request.headers.get("cookie") || "";
      const expectedState = cookies.match(/oauth_state=([^;]+)/)?.[1];

      if (!code) return redirectToApp("error=missing_code");
      if (!state || state !== expectedState) {
        context.warn("OAuth state mismatch — possible CSRF attempt.");
        return redirectToApp("error=state_mismatch");
      }

      // --- exchange the one-time code for an access token ---
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${process.env.API_BASE_URL}/api/auth/github/callback`
          })
        }
      );
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        context.error("Token exchange failed:", tokenData.error_description);
        return redirectToApp("error=token_exchange_failed");
      }

      const gh = {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "nutritional-insights"
      };

      // --- read the profile ---
      const profile = await (
        await fetch("https://api.github.com/user", { headers: gh })
      ).json();

      // GitHub omits the email on /user when the user marks it private, so
      // fall back to the verified primary from /user/emails.
      let email = profile.email;
      if (!email) {
        const emails = await (
          await fetch("https://api.github.com/user/emails", { headers: gh })
        ).json();
        email =
          (Array.isArray(emails) &&
            emails.find((e) => e.primary && e.verified)?.email) ||
          null;
      }

      // --- upsert the user ---
      const id = `github:${profile.id}`;
      const existing = await findUserById(id);
      const user = {
        id,
        email,
        displayName: profile.name || profile.login,
        provider: "github",
        // Note: no passwordHash field at all on OAuth accounts.
        createdAt: existing?.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      await getUsersContainer().items.upsert(user);
      context.log(`GitHub login: ${user.displayName} (${id})`);

      return redirectToApp(`token=${encodeURIComponent(signToken(user))}`);
    } catch (err) {
      context.error(err);
      return redirectToApp("error=server_error");
    }
  }
});
