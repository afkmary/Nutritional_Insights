// One-off local ETL run: does exactly what onDietsCsvChange does, but invoked
// by hand instead of by an Event Grid blob event (which only fires in Azure).
//
// Use this to populate Cosmos so the dashboard has data during local dev.
//
// Usage, from the backend/ folder:
//   node scripts/seed-cosmos.js data/All_Diets.csv

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

// Standalone node doesn't get local.settings.json the way `func start` does,
// so load it manually.
const settingsPath = path.join(__dirname, "..", "local.settings.json");
if (fs.existsSync(settingsPath)) {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  for (const [k, v] of Object.entries(settings.Values || {})) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const { getContainer } = require("../shared/cosmosClient");
const {
  parseAndCleanCsv,
  recipeId,
  computeChartPayloads
} = require("../shared/dietProcessing");

const csvPath = process.argv[2] || path.join(__dirname, "..", "data", "All_Diets.csv");

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  console.log(`Reading ${csvPath}`);
  const csvText = fs.readFileSync(csvPath, "utf8");

  const rows = parseAndCleanCsv(csvText);
  console.log(`Cleaned ${rows.length} rows`);

  // --- chart payloads -> results container ---
  const payloads = computeChartPayloads(rows);
  const resultsContainer = getContainer("results");
  await Promise.all(
    Object.values(payloads).map((doc) =>
      resultsContainer.items.upsert({
        ...doc,
        runId,
        updatedAt: new Date().toISOString()
      })
    )
  );
  console.log("Wrote 4 chart docs to results");

  // --- recipes -> recipes container ---
  const recipesContainer = getContainer("recipes");
  const CONCURRENCY = 20;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map((row, j) =>
        recipesContainer.items
          .upsert({
            id: recipeId(row, i + j),
            dietType: row.dietType,
            name: row.recipeName,
            cuisineType: row.cuisineType,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            runId
          })
          .then(() => done++)
          .catch((err) => {
            failed++;
            if (failed <= 3) console.error(`  upsert failed: ${err.message}`);
          })
      )
    );
    if ((i / CONCURRENCY) % 20 === 0) {
      process.stdout.write(`\r  ${done}/${rows.length} recipes…`);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`\rWrote ${done}/${rows.length} recipes (${failed} failed)      `);

  // --- meta doc ---
  await resultsContainer.items.upsert({
    id: "lastProcessed",
    chartType: "meta",
    runId,
    rowCount: rows.length,
    recipesWritten: done,
    recipesFailed: failed,
    durationMs,
    processedAt: new Date().toISOString(),
    note: "seeded manually via scripts/seed-cosmos.js"
  });

  console.log(`\nDone in ${(durationMs / 1000).toFixed(1)}s (runId ${runId})`);
  console.log(
    "Note this duration — the Consumption plan default function timeout is 5 minutes."
  );
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
