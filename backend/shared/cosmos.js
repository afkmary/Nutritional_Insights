// Person B's user-store helpers.
//
// Person A's shared/cosmosClient.js already owns the CosmosClient singleton
// and the container handles. Reuse it rather than constructing a second
// client — two clients means two connection pools on every warm instance,
// two sets of credentials to keep in sync, and double the cold-start cost.
//
// This file replaces the earlier standalone shared/cosmos.js.

const { getContainer } = require("./cosmosClient");

function getUsersContainer() {
  return getContainer("users");
}

/**
 * Point read by id. The users container is partitioned on /id and the id IS
 * the account key, so partition key and id are the same value — the cheapest
 * possible Cosmos operation (1 RU).
 *
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
