const { CosmosClient } = require("@azure/cosmos");

let client = null;
let database = null;
const containers = {};

function getClient() {
  if (client) return client;

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (!endpoint || !key) {
    throw new Error(
      "COSMOS_ENDPOINT / COSMOS_KEY are not set. Check local.settings.json (local) or Function App settings (cloud)."
    );
  }

  client = new CosmosClient({ endpoint, key });
  return client;
}

function getDatabase() {
  if (database) return database;
  const dbName = process.env.COSMOS_DATABASE || "dietdb";
  database = getClient().database(dbName);
  return database;
}

/**
 * Get a handle to one of the three containers.
 * @param {"results"|"recipes"|"users"} name
 */
function getContainer(name) {
  if (containers[name]) return containers[name];
  containers[name] = getDatabase().container(name);
  return containers[name];
}

module.exports = { getClient, getDatabase, getContainer };
