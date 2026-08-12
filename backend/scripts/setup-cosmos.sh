# Usage:
#   RESOURCE_GROUP=diet-analysis-rg COSMOS_ACCOUNT=dietanalysis-cosmos LOCATION=eastus \
#     ./scripts/setup-cosmos.sh

set -euo pipefail

: "${RESOURCE_GROUP:?Set RESOURCE_GROUP}"
: "${COSMOS_ACCOUNT:?Set COSMOS_ACCOUNT (must be globally unique, lowercase)}"
: "${LOCATION:=canadacentral}"
DATABASE="dietdb"

echo "==> Creating Cosmos DB account '$COSMOS_ACCOUNT' (serverless, free tier)..."
az cosmosdb create \
  --name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --locations regionName="$LOCATION" failoverPriority=0 isZoneRedundant=false \
  --capabilities EnableServerless \
  --default-consistency-level Session

echo "==> Creating database '$DATABASE'..."
az cosmosdb sql database create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DATABASE"

echo "==> Creating container 'results' (partition key /id — 5 small fixed docs: bar, scatter, heatmap, pie, lastProcessed)..."
az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --database-name "$DATABASE" \
  --name results \
  --partition-key-path "/id"

echo "==> Creating container 'recipes' (partition key /dietType — cleaned rows)..."
az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --database-name "$DATABASE" \
  --name recipes \
  --partition-key-path "/dietType"

echo "==> Creating container 'users' (partition key /id — teammate B fills the auth logic)..."
az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --database-name "$DATABASE" \
  --name users \
  --partition-key-path "/id"

echo "==> Done. Fetch the endpoint + key with:"
echo "az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query documentEndpoint -o tsv"
echo "az cosmosdb keys list --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query primaryMasterKey -o tsv"
