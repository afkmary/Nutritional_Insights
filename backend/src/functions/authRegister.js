const { app } = require("@azure/functions");
const bcrypt = require("bcryptjs");
const { getUsersContainer, findUserById } = require("../../shared/cosmos");
const { signToken, json, publicUser } = require("../../shared/auth");

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BCRYPT_COST = 12;

// POST /api/auth/register  { email, password, displayName? }

app.http("AuthRegister", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/register",
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
      const displayName =
        String(body.displayName || "").trim() || email.split("@")[0];

      if (!EMAIL_RE.test(email)) {
        return json(400, { error: "A valid email address is required." });
      }
      if (password.length < 8) {
        return json(400, { error: "Password must be at least 8 characters." });
      }

      if (await findUserById(email)) {
        return json(409, { error: "An account with that email already exists." });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

      const user = {
        id: email,
        email,
        displayName,
        provider: "local",
        passwordHash,
        createdAt: new Date().toISOString()
      };

      await getUsersContainer().items.create(user);
      context.log(`Registered new local account: ${email}`);

      return json(201, { token: signToken(user), user: publicUser(user) });
    } catch (err) {
      context.error(err);
      return json(500, { error: "Registration failed." });
    }
  }
});
