const { app } = require("@azure/functions");
const { getContainer } = require("../../shared/cosmosClient");
const { requireAuth } = require("../../shared/auth");

app.http("GetNutritionalInsights", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "insights",
  handler: async (request, context) => {
    const denied = requireAuth(request);
    if (denied) return denied;
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
