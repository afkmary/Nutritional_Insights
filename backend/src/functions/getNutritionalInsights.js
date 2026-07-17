const { app } = require("@azure/functions");
const { loadDietData } = require("../../shared/dietData");

// GET /api/insights?diet=keto
// Powers: Bar Chart (avg macros per diet type), Scatter Plot (protein vs carbs),
// and Heatmap (nutrient correlations) on the dashboard.

app.http("GetNutritionalInsights", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "insights",
  handler: async (request, context) => {
    const start = Date.now();
    try {
      const rows = await loadDietData();
      const dietFilter = request.query.get("diet");

      const filtered = dietFilter
        ? rows.filter((r) => r.dietType.toLowerCase() === dietFilter.toLowerCase())
        : rows;

      // --- Bar chart data: average macros per diet type ---
      const groups = {};
      for (const r of filtered) {
        if (!groups[r.dietType]) {
          groups[r.dietType] = { protein: 0, carbs: 0, fat: 0, count: 0 };
        }
        groups[r.dietType].protein += r.protein;
        groups[r.dietType].carbs += r.carbs;
        groups[r.dietType].fat += r.fat;
        groups[r.dietType].count += 1;
      }
      const insights = Object.entries(groups).map(([dietType, g]) => ({
        dietType,
        avgProtein: +(g.protein / g.count).toFixed(2),
        avgCarbs: +(g.carbs / g.count).toFixed(2),
        avgFat: +(g.fat / g.count).toFixed(2),
        recipeCount: g.count
      }));

      // --- Scatter plot data: protein vs carbs (sampled to keep payload small) ---
      const scatterSample = filtered
        .slice(0, 500)
        .map((r) => ({ dietType: r.dietType, protein: r.protein, carbs: r.carbs, fat: r.fat }));

      // --- Heatmap data: correlation matrix between protein/carbs/fat ---
      const correlation = buildCorrelationMatrix(filtered);

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

function buildCorrelationMatrix(rows) {
  const fields = ["protein", "carbs", "fat"];
  const n = rows.length;
  if (n === 0) return {};

  const means = {};
  for (const f of fields) {
    means[f] = rows.reduce((sum, r) => sum + r[f], 0) / n;
  }

  const matrix = {};
  for (const a of fields) {
    matrix[a] = {};
    for (const b of fields) {
      let num = 0, denA = 0, denB = 0;
      for (const r of rows) {
        const da = r[a] - means[a];
        const db = r[b] - means[b];
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const corr = denA && denB ? num / Math.sqrt(denA * denB) : 0;
      matrix[a][b] = +corr.toFixed(3);
    }
  }
  return matrix;
}
