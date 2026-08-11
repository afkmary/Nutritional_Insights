#!/usr/bin/env bash
# Wires an Event Grid subscription so onDietsCsvChange fires within seconds
# of an upload, instead of the classic blob trigger's up-to-10-minute poll
# on a Consumption plan. Run this AFTER `func azure functionapp publish`.
#
# Usage:
#   RESOURCE_GROUP=diet-analysis-rg STORAGE_ACCOUNT=dietanalysisstorage77 \
#     FUNCTION_APP=diet-analysis-func-marya ./scripts/setup-event-grid.sh

set -euo pipefail

: "${RESOURCE_GROUP:?Set RESOURCE_GROUP}"
: "${STORAGE_ACCOUNT:?Set STORAGE_ACCOUNT}"
: "${FUNCTION_APP:?Set FUNCTION_APP}"
FUNCTION_NAME="onDietsCsvChange"
SUBSCRIPTION_NAME="onDietsCsvChange-sub"

echo "==> Registering Microsoft.EventGrid resource provider (no-op if already registered)..."
az provider register --namespace Microsoft.EventGrid --wait

STORAGE_ID=$(az storage account show \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

FUNCTION_ID=$(az functionapp show \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

echo "==> Creating Event Grid subscription (scoped to diet-data/All_Diets.csv only)..."
az eventgrid event-subscription create \
  --name "$SUBSCRIPTION_NAME" \
  --source-resource-id "$STORAGE_ID" \
  --endpoint-type azurefunction \
  --endpoint "${FUNCTION_ID}/functions/${FUNCTION_NAME}" \
  --included-event-types Microsoft.Storage.BlobCreated \
  --subject-begins-with "/blobServices/default/containers/diet-data/blobs/All_Diets.csv"

echo "==> Done. Verify with:"
echo "az eventgrid event-subscription show --name $SUBSCRIPTION_NAME --source-resource-id $STORAGE_ID"
