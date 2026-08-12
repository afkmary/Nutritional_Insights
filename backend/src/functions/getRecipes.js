const { app } = require("@azure/functions");
const { getContainer } = require("../../shared/cosmosClient");
const { requireAuth } = require("../../shared/auth");

// GET /api/recipes?diet=keto&q=chicken&page=1&pageSize=10
// Powers: Pie Chart, search/filter controls, pagination.
//
// Phase 3: this is a live Cosmos SQL query (not a precomputed doc) because
// diet/search/page are arbitrary per-request inputs. It reads from the
// `recipes` container populated by onDietsCsvChange — there is no CSV/blob
// access or pandas-equivalent logic in this handler.
//
// Accepts `q` (per spec) and also `search` (legacy alias so the existing
// frontend contract in api.js keeps working without a frontend change).

app.http("GetRecipes", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "recipes",
  handler: async (request, context) => {
    const denied = requireAuth(request);
    if (denied) return denied;
    const start = Date.now();
    try {
      const diet = (request.query.get("diet") || "").toLowerCase() || null;
      const q = request.query.get("q") || request.query.get("search") || "";
      const page = Math.max(1, parseInt(request.query.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(request.query.get("pageSize")) || 10));
      const offset = (page - 1) * pageSize;

      const container = getContainer("recipes");
      const { where, parameters } = buildFilter(diet, q);

      const dataQuery = {
        query: `SELECT c.id, c.name, c.dietType, c.cuisineType, c.protein, c.carbs, c.fat
                 FROM c ${where}
                 ORDER BY c.name
                 OFFSET @offset LIMIT @pageSize`,
        parameters: [...parameters, { name: "@offset", value: offset }, { name: "@pageSize", value: pageSize }]
      };
      const countQuery = {
        query: `SELECT VALUE COUNT(1) FROM c ${where}`,
        parameters
      };

      // Cosmos JS SDK v4 runs cross-partition queries automatically when no
      // partitionKey is supplied — no extra flag needed.
      const queryOptions = diet ? { partitionKey: diet } : {};

      const [dataResult, countResult, pieDoc] = await Promise.all([
        container.items.query(dataQuery, queryOptions).fetchAll(),
        container.items.query(countQuery, queryOptions).fetchAll(),
        getContainer("results").item("pie", "pie").read().catch(() => ({ resource: null }))
      ]);

      const recipes = dataResult.resources.map((doc) => ({
        recipeName: doc.name,
        dietType: doc.dietType,
        cuisineType: doc.cuisineType,
        protein: doc.protein,
        carbs: doc.carbs,
        fat: doc.fat
      }));

      const totalCount = countResult.resources[0] || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      return {
        jsonBody: {
          executionTimeMs: Date.now() - start,
          page,
          pageSize,
          totalCount,
          totalPages,
          recipes,
          distribution: pieDoc.resource?.distribution || {}
        }
      };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});

function buildFilter(diet, q) {
  const conditions = [];
  const parameters = [];

  if (diet) {
    conditions.push("c.dietType = @diet");
    parameters.push({ name: "@diet", value: diet });
  }
  if (q) {
    conditions.push("CONTAINS(LOWER(c.name), @q)");
    parameters.push({ name: "@q", value: q.toLowerCase() });
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, parameters };
}
