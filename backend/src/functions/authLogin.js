const { app } = require("@azure/functions");
const bcrypt = require("bcryptjs");
const { findUserById } = require("../../shared/cosmos");
const { signToken, json, publicUser } = require("../../shared/auth");

// Deliberately identical for "no such user" and "wrong password" so this
// endpoint can't be used to discover which emails have accounts.
const BAD_CREDENTIALS = { error: "Incorrect email or password." };

// POST /api/auth/login  { email, password }

app.http("AuthLogin", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/login",
  handler: async (request, context) => {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "Invalid JSON body." });
      }

      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return json(401, BAD_CREDENTIALS);

      const user = await findUserById(email);
      if (!user) return json(401, BAD_CREDENTIALS);

      if (user.provider !== "local" || !user.passwordHash) {
        return json(409, {
          error: `That email is registered through ${user.provider}. Use the ${user.provider} button to sign in.`
        });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        context.log(`Failed login attempt for ${email}`);
        return json(401, BAD_CREDENTIALS);
      }

      return json(200, { token: signToken(user), user: publicUser(user) });
    } catch (err) {
      context.error(err);
      return json(500, { error: "Login failed." });
    }
  }
});
