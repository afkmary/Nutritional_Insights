# Diet Analysis Function — Phase 3 (Backend, Caching, Data APIs)

This covers the "Backend, caching, data APIs" slice of Phase 3: the blob-triggered
ETL, the 3 rewritten/new HTTP endpoints, and the Cosmos DB setup they read from.
User login/registration and the `users` container's app logic are a teammate's
part — this README creates the `users` container shell so they have somewhere
to write to, but doesn't implement auth.

## What changed from Phase 2

Phase 2: every HTTP request re-downloaded and re-parsed `All_Diets.csv` from
Blob Storage, then recomputed everything in memory (with a 5-minute
in-process cache as a stopgap).

Phase 3:

```
                 upload All_Diets.csv
                        │
                        ▼
        Event Grid notifies (near-instant, not polling)
                        │
                        ▼
      onDietsCsvChange (blob trigger, source: EventGrid)
        1. download + clean CSV
        2. compute all 4 chart payloads (bar/scatter/heatmap/pie)
        3. upsert → Cosmos `results` (1 doc per chart)
        4. upsert → Cosmos `recipes` (1 doc per row, partition /dietType)
        5. write meta/lastProcessed (runId, timestamp, duration)
                        │
                        ▼
   ┌────────────────────┴─────────────────────┐
   ▼                    ▼                     ▼
GET /api/insights   GET /api/clusters   GET /api/recipes
(pure Cosmos read,   (Cosmos read +      (Cosmos SQL: diet filter,
 no CSV/blob logic)   in-memory k-means)  CONTAINS search, OFFSET/LIMIT)
```

The CSV is only ever parsed in `onDietsCsvChange`. Every HTTP function reads
from Cosmos. Ten dashboard refreshes in a row cost zero recompute.

## Cosmos DB

Database `dietdb`, 3 containers:

| Container | Partition key | Contents |
|---|---|---|
| `results` | `/id` | 5 small fixed docs: `bar`, `scatter`, `heatmap`, `pie`, `lastProcessed` |
| `recipes` | `/dietType` | one doc per cleaned CSV row |
| `users` | `/id` | empty shell — teammate B's auth logic writes here |

Cosmos DB encrypts all data at rest by default (server-side, no config
needed) — that covers the "data at rest is encrypted" requirement for
whatever this DB stores, including `users`.

### Create it

```bash
export RESOURCE_GROUP=diet-analysis-rg
export COSMOS_ACCOUNT=dietanalysis-cosmos   # must be globally unique
export LOCATION=eastus
./scripts/setup-cosmos.sh
```

This provisions a **serverless, free-tier** account (pay-per-request, no
idle cost — right choice for a dashboard with bursty, low traffic instead of
provisioned RU/s).

Grab the endpoint/key and put them in `local.settings.json` (copy from
`local.settings.json.example`) and in the Function App's cloud settings:

```bash
az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query documentEndpoint -o tsv
az cosmosdb keys list --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query primaryMasterKey -o tsv

az functionapp config appsettings set \
  --name <your-function-app> --resource-group $RESOURCE_GROUP \
  --settings "COSMOS_ENDPOINT=<endpoint>" "COSMOS_KEY=<key>" "COSMOS_DATABASE=dietdb"
```

## Install & run locally

```bash
npm install
cp local.settings.json.example local.settings.json   # fill in real values
func start
```

Upload a CSV once so there's data to read, then hit:
```
http://localhost:7071/api/insights
http://localhost:7071/api/recipes?page=1&pageSize=10
http://localhost:7071/api/clusters?k=3
```

Note: the Event Grid blob trigger only fires reliably in the cloud (it needs
a real Event Grid subscription against the storage account). Locally, you
can invoke the cleaning logic directly for testing — see "Testing the ETL
locally" below.

## Deploy

```bash
func azure functionapp publish <your-function-app>
```

### ⚠️ Gotcha: wire up Event Grid, don't rely on the classic blob trigger

`onDietsCsvChange` is declared with `source: "EventGrid"` in code, but that
alone doesn't make events flow — you still need an actual Event Grid
subscription pointed at the deployed function. Without it, **nothing fires
at all** (this is not the same as falling back to slow polling — Event
Grid–sourced triggers need the subscription to exist).

```bash
export RESOURCE_GROUP=diet-analysis-rg
export STORAGE_ACCOUNT=dietanalysisstorage77
export FUNCTION_APP=<your-function-app>
./scripts/setup-event-grid.sh
```

This registers the `Microsoft.EventGrid` provider (if needed) and creates a
subscription scoped specifically to `diet-data/All_Diets.csv`, so unrelated
blob uploads don't trigger it. Once this is in place, uploads fire the
function in seconds — not the classic trigger's up-to-10-minute poll delay
on a Consumption plan.

## Testing the ETL locally (without Event Grid)

```bash
node -e "
const { parseAndCleanCsv, computeChartPayloads } = require('./shared/dietProcessing');
const fs = require('fs');
const rows = parseAndCleanCsv(fs.readFileSync('demo/All_Diets_v1.csv', 'utf8'));
console.log(rows.length, 'rows cleaned');
console.log(JSON.stringify(computeChartPayloads(rows).bar.byDiet.all, null, 2));
"
```

## Demo script (proving caching actually works)

1. Generate two CSV versions with a visible difference:
   ```bash
   node scripts/make-demo-csvs.js /path/to/original/All_Diets.csv
   ```
2. Start streaming logs in one terminal:
   ```bash
   func azure functionapp logstream --name <your-function-app>
   ```
3. Upload v1:
   ```bash
   az storage blob upload --account-name <acct> --container-name diet-data \
     --name All_Diets.csv --file demo/All_Diets_v1.csv --auth-mode key --overwrite
   ```
   → log shows `onDietsCsvChange run ... started` **once**, then `... complete in NNNms`.
4. Refresh the dashboard 10 times. → zero new `onDietsCsvChange` lines — only
   `GetNutritionalInsights` / `GetRecipes` / `GetClusters` HTTP invocation logs.
5. Upload v2:
   ```bash
   az storage blob upload --account-name <acct> --container-name diet-data \
     --name All_Diets.csv --file demo/All_Diets_v2.csv --auth-mode key --overwrite
   ```
   → `onDietsCsvChange` fires again. Keto's `avgProtein` in `/api/insights?diet=keto`
   visibly jumps by ~25, and `/api/recipes?diet=keto&q=demo` now returns the
   injected "DEMO Phase3 Test Recipe" row.
6. Pull up `results/lastProcessed` in the Cosmos Data Explorer (or
   `GET` it via the SDK) as your on-screen proof: `runId`, `rowCount`,
   `durationMs`, `processedAt` should all reflect run #2.

## API contracts (unchanged from the frontend's point of view)

| Endpoint | Route | Notes |
|---|---|---|
| Get Nutritional Insights | `GET /api/insights?diet=keto` | Same response shape as Phase 2: `insights`, `scatterSample`, `correlation`. Now a pure Cosmos read. |
| Get Recipes | `GET /api/recipes?diet=keto&q=chicken&page=1&pageSize=10` | `q` is the spec'd param name; `search` still works as an alias so `frontend/src/api.js` needs no changes. Adds real server-side pagination (`OFFSET`/`LIMIT`) and `totalCount`/`totalPages`. |
| Get Clusters | `GET /api/clusters?diet=keto&k=3` | Rows now sourced from Cosmos `recipes`, not the CSV blob. k-means still runs per-request since `k` is arbitrary. |

All three still return `executionTimeMs`.
