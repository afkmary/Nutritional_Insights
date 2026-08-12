const { getContainer } = require("./cosmosClient");

function getUsersContainer() {
  return getContainer("users");
}

/**
 * ids look like:
 *   "mary@example.com"  for local email/password accounts
 *   "github:12345"      for OAuth accounts
 *
 * Returns undefined when the document does not exist (the SDK does not throw
 * on a 404 for point reads).
 */
async function findUserById(id) {
  const { resource } = await getUsersContainer().item(id, id).read();
  return resource;
}

module.exports = { getUsersContainer, findUserById };
