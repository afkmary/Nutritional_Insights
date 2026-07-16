const { app } = require("@azure/functions");
const { loadDietData } = require("../../shared/dietData");

// GET /api/recipes?diet=keto&search=chicken&page=1&pageSize=10
// Powers: Pie Chart (recipe distribution by diet type), Search/Filter controls,
// and Pagination on the dashboard.
app.http("GetRecipes", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "recipes",
  handler: async (request, context) => {
    const start = Date.now();
    try {
      const rows = await loadDietData();
      const dietFilter = request.query.get("diet");
      const search = request.query.get("search");
      const page = parseInt(request.query.get("page")) || 1;
      const pageSize = parseInt(request.query.get("pageSize")) || 10;

      let filtered = rows;
      if (dietFilter) {
        filtered = filtered.filter((r) => r.dietType.toLowerCase() === dietFilter.toLowerCase());
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter((r) => r.recipeName.toLowerCase().includes(s));
      }

      // Pie chart: recipe distribution by diet type (respects search, ignores the
      // diet dropdown so the pie stays meaningful as a "distribution" view)
      const distributionSource = search
        ? rows.filter((r) => r.recipeName.toLowerCase().includes(search.toLowerCase()))
        : rows;
      const distribution = {};
      for (const r of distributionSource) {
        distribution[r.dietType] = (distribution[r.dietType] || 0) + 1;
      }

      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const pageStart = (page - 1) * pageSize;
      const pageRows = filtered.slice(pageStart, pageStart + pageSize);

      return {
        jsonBody: {
          executionTimeMs: Date.now() - start,
          page,
          pageSize,
          totalCount,
          totalPages,
          recipes: pageRows,
          distribution
        }
      };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});
