const { app } = require("@azure/functions");
const { randomUUID } = require("crypto");
const { getContainer } = require("../../shared/cosmosClient");
const { parseAndCleanCsv, recipeId, computeChartPayloads } = require("../../shared/dietProcessing");

// ---------------------------------------------------------------------------
// Blob-triggered ETL. Uses the EVENT GRID source (not the classic polling
// blob trigger) so it fires within seconds of an upload instead of the
// classic trigger's up-to-10-minute polling delay on a Consumption plan.
//
// Path pattern matches diet-data/All_Diets.csv specifically — uploads of
// anything else in that container do not fire this function.
// ---------------------------------------------------------------------------
app.storageBlob("onDietsCsvChange", {
  path: "diet-data/All_Diets.csv",
  connection: "AzureWebJobsStorage",
  source: "EventGrid",
  handler: async (blob, context) => {
    const runId = randomUUID();
    const startedAt = Date.now();
    context.log(`[onDietsCsvChange] run ${runId} started, blob size=${blob.length} bytes`);

    try {
      const csvText = Buffer.isBuffer(blob) ? blob.toString("utf8") : String(blob);

      // 1. Clean
      const rows = parseAndCleanCsv(csvText);
      context.log(`[onDietsCsvChange] run ${runId} cleaned ${rows.length} rows`);

      // 2. Aggregate (all 4 chart payloads)
      const payloads = computeChartPayloads(rows);

      // 3. Persist: results container (4 chart docs)
      const resultsContainer = getContainer("results");
      await Promise.all(
        Object.values(payloads).map((doc) =>
          resultsContainer.items.upsert({ ...doc, runId, updatedAt: new Date().toISOString() })
        )
      );

      // 4. Persist: recipes container (cleaned rows, partitioned by dietType)
      const recipesContainer = getContainer("recipes");
      await upsertRecipes(recipesContainer, rows, runId, context);

      // 5. Remove recipes left over from a previous run (deleted from source CSV)
      const removed = await removeStaleRecipes(recipesContainer, rows, runId, context);

      const durationMs = Date.now() - startedAt;

      // 6. meta/lastProcessed — the demo proof that this only runs on change
      await resultsContainer.items.upsert({
        id: "lastProcessed",
        chartType: "meta",
        runId,
        rowCount: rows.length,
        recipesRemoved: removed,
        blobSizeBytes: blob.length,
        durationMs,
        processedAt: new Date().toISOString()
      });

      context.log(
        `[onDietsCsvChange] run ${runId} complete in ${durationMs}ms — ${rows.length} rows, ${removed} stale recipes removed`
      );
    } catch (err) {
      context.error(`[onDietsCsvChange] run ${runId} FAILED: ${err.message}`);
      throw err; // let the Functions host record the failure / retry per host.json policy
    }
  }
});

/** Upsert with limited concurrency so we don't blow past Cosmos RU throughput. */
async function upsertRecipes(container, rows, runId, context, concurrency = 20) {
  let i = 0;
  let inFlight = 0;
  let resolveDone;
  const done = new Promise((res) => (resolveDone = res));

  return new Promise((resolve, reject) => {
    function pump() {
      if (i >= rows.length && inFlight === 0) return resolve();
      while (inFlight < concurrency && i < rows.length) {
        const idx = i++;
        const row = rows[idx];
        inFlight++;
        container.items
          .upsert({
            id: recipeId(row, idx),
            dietType: row.dietType,
            name: row.recipeName,
            cuisineType: row.cuisineType,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            runId
          })
          .catch((err) => {
            context.error(`[onDietsCsvChange] failed to upsert recipe idx=${idx}: ${err.message}`);
          })
          .finally(() => {
            inFlight--;
            pump();
          });
      }
    }
    pump();
  });
}

/** Delete any recipe docs whose runId doesn't match this run (source rows removed). */
async function removeStaleRecipes(container, rows, runId, context) {
  const dietTypes = [...new Set(rows.map((r) => r.dietType))];
  let removed = 0;

  for (const dietType of dietTypes) {
    const query = {
      query: "SELECT c.id FROM c WHERE c.dietType = @dietType AND c.runId != @runId",
      parameters: [
        { name: "@dietType", value: dietType },
        { name: "@runId", value: runId }
      ]
    };
    const { resources: stale } = await container.items
      .query(query, { partitionKey: dietType })
      .fetchAll();

    await Promise.all(
      stale.map((doc) =>
        container.item(doc.id, dietType).delete().catch((err) => {
          context.error(`[onDietsCsvChange] failed to delete stale recipe ${doc.id}: ${err.message}`);
        })
      )
    );
    removed += stale.length;
  }
  return removed;
}
