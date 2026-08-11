const { app } = require("@azure/functions");
const { getContainer } = require("../../shared/cosmosClient");

// GET /api/insights?diet=keto
// Powers: Bar Chart, Scatter Plot, Heatmap.
//
// Phase 3: this is now a PURE Cosmos read. All cleaning/aggregation math
// happens once in onDietsCsvChange (the blob-trigger ETL) — this handler
// just fetches the 3 precomputed docs and picks out the requested diet
// slice. No CSV parsing, no pandas-equivalent logic, no blob access here.

app.http("GetNutritionalInsights", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "insights",
  handler: async (request, context) => {
    const start = Date.now();
    try {
      const dietKey = (request.query.get("diet") || "all").toLowerCase();
      const container = getContainer("results");

      const [{ resource: barDoc }, { resource: scatterDoc }, { resource: heatmapDoc }] =
        await Promise.all([
          container.item("bar", "bar").read(),
          container.item("scatter", "scatter").read(),
          container.item("heatmap", "heatmap").read()
        ]);

      const insights = pickDiet(barDoc?.byDiet, dietKey) || [];
      const scatterSample = pickDiet(scatterDoc?.byDiet, dietKey) || [];
      const correlation = pickDiet(heatmapDoc?.byDiet, dietKey) || {};

      return {
        jsonBody: {
          executionTimeMs: Date.now() - start,
          insights,
          scatterSample,
          correlation
        }
      };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});

/** byDiet keys are lowercase diet types (see dietProcessing.parseAndCleanCsv), so this is an exact lookup. */
function pickDiet(byDiet, dietKey) {
  if (!byDiet) return undefined;
  return byDiet[dietKey] ?? byDiet.all;
}
