const { app } = require("@azure/functions");
const { loadDietData } = require("../../shared/dietData");

// GET /api/clusters?diet=keto&k=3
// Powers: "Get Clusters" button - groups recipes into k clusters based on
// protein/carbs/fat similarity using a lightweight k-means implementation

app.http("GetClusters", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "clusters",
  handler: async (request, context) => {
    const start = Date.now();
    try {
      const rows = await loadDietData();
      const dietFilter = request.query.get("diet");
      const k = parseInt(request.query.get("k")) || 3;

      const filtered = dietFilter
        ? rows.filter((r) => r.dietType.toLowerCase() === dietFilter.toLowerCase())
        : rows;

      // Sample for performance on large datasets
      const sample = filtered.length > 1000 ? filtered.slice(0, 1000) : filtered;
      const points = sample.map((r) => [r.protein, r.carbs, r.fat]);

      const { assignments, centroids } = kmeans(points, Math.min(k, points.length || 1));

      const clusters = sample.map((r, i) => ({
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
