const { app } = require("@azure/functions");
const { getContainer } = require("../../shared/cosmosClient");
const { requireAuth } = require("../../shared/auth");

// GET /api/clusters?diet=keto&k=3
// Powers: "Get Clusters" button — groups recipes into k clusters based on
// protein/carbs/fat similarity using a lightweight k-means implementation.
//
// Phase 3: rows now come from the `recipes` Cosmos container (populated by
// onDietsCsvChange), not the CSV blob. There is no CSV/blob access left in
// this handler. k-means itself still runs per-request because k is an
// arbitrary user input that can't be fully precomputed ahead of time — but
// it now runs against a small, already-cleaned, indexed Cosmos read instead
// of re-parsing the whole dataset from blob storage on every call.

app.http("GetClusters", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "clusters",
  handler: async (request, context) => {
    const denied = requireAuth(request);
    if (denied) return denied;
    const start = Date.now();
    try {
      const dietFilter = (request.query.get("diet") || "").toLowerCase() || null;
      const k = parseInt(request.query.get("k")) || 3;
      const SAMPLE_LIMIT = 1000;

      const rows = await loadRowsFromCosmos(dietFilter, SAMPLE_LIMIT);

      const points = rows.map((r) => [r.protein, r.carbs, r.fat]);
      const { assignments, centroids } = kmeans(points, Math.min(k, points.length || 1));

      const clusters = rows.map((r, i) => ({
        recipeName: r.recipeName,
        dietType: r.dietType,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        cluster: assignments[i]
      }));

      return {
        jsonBody: {
          executionTimeMs: Date.now() - start,
          k,
          centroids: centroids.map((c) => ({
            avgProtein: +c[0].toFixed(2),
            avgCarbs: +c[1].toFixed(2),
            avgFat: +c[2].toFixed(2)
          })),
          clusters
        }
      };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});

async function loadRowsFromCosmos(dietFilter, limit) {
  const container = getContainer("recipes");

  if (dietFilter) {
    const query = {
      query: "SELECT TOP @limit c.name, c.dietType, c.protein, c.carbs, c.fat FROM c WHERE c.dietType = @diet",
      parameters: [
        { name: "@limit", value: limit },
        { name: "@diet", value: dietFilter }
      ]
    };
    const { resources } = await container.items
      .query(query, { partitionKey: dietFilter })
      .fetchAll();
    return resources.map(normalize);
  }

  // No diet filter: cross-partition query, still capped for performance.
  const query = { query: "SELECT TOP @limit c.name, c.dietType, c.protein, c.carbs, c.fat FROM c" };
  query.parameters = [{ name: "@limit", value: limit }];
  const { resources } = await container.items.query(query).fetchAll();
  return resources.map(normalize);
}

function normalize(doc) {
  return {
    recipeName: doc.name,
    dietType: doc.dietType,
    protein: doc.protein,
    carbs: doc.carbs,
    fat: doc.fat
  };
}

function kmeans(points, k, iterations = 15) {
  if (points.length === 0) return { assignments: [], centroids: [] };

  let centroids = points.slice(0, k).map((p) => [...p]);
  let assignments = new Array(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < points.length; i++) {
      let bestDist = Infinity, bestC = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist(points[i], centroids[c]);
        if (d < bestDist) { bestDist = d; bestC = c; }
      }
      assignments[i] = bestC;
    }

    const sums = Array.from({ length: centroids.length }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      sums[c][0] += points[i][0];
      sums[c][1] += points[i][1];
      sums[c][2] += points[i][2];
      sums[c][3] += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  return { assignments, centroids };
}

function dist(a, b) {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}
