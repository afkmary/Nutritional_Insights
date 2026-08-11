const { parse } = require("csv-parse/sync");

const DISTINCT_FIELDS = ["protein", "carbs", "fat"];
const ALL_KEY = "all";

/**
 * Parse raw CSV text into normalized recipe rows.
 * (Same normalization Phase 2 used in shared/dietData.js.)
 */
function parseAndCleanCsv(csvText) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const rows = [];
  for (const r of records) {
    // Lowercased: the frontend dropdown and every downstream Cosmos query
    // use lowercase diet keys ("keto", "paleo", ...), and Cosmos exact-match
    // / partition-key lookups are case-sensitive, so normalize here once.
    const dietType = (r.Diet_type || "").trim().toLowerCase();
    const recipeName = (r.Recipe_name || "").trim();

    // Data cleaning: drop rows missing the fields we group/search on.
    if (!dietType || !recipeName) continue;

    rows.push({
      dietType,
      recipeName,
      cuisineType: (r.Cuisine_type || "").trim(),
      protein: parseFloat(r["Protein(g)"]) || 0,
      carbs: parseFloat(r["Carbs(g)"]) || 0,
      fat: parseFloat(r["Fat(g)"]) || 0
    });
  }
  return rows;
}

/** Deterministic id for a recipe doc, stable across re-runs of the ETL. */
function recipeId(row, index) {
  // dietType is the partition key, so the id only needs to be unique
  // *within* that partition. Index is stable given a stable CSV row order.
  const safeName = row.recipeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
  return `${safeName}-${index}`;
}

function average(nums) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildBarPayload(rowsByDiet) {
  // One entry per diet type present in this slice (matches Phase 2 shape).
  const build = (rows) => {
    const groups = {};
    for (const r of rows) {
      if (!groups[r.dietType]) {
        groups[r.dietType] = { protein: 0, carbs: 0, fat: 0, count: 0 };
      }
      groups[r.dietType].protein += r.protein;
      groups[r.dietType].carbs += r.carbs;
      groups[r.dietType].fat += r.fat;
      groups[r.dietType].count += 1;
    }
    return Object.entries(groups).map(([dietType, g]) => ({
      dietType,
      avgProtein: +(g.protein / g.count).toFixed(2),
      avgCarbs: +(g.carbs / g.count).toFixed(2),
      avgFat: +(g.fat / g.count).toFixed(2),
      recipeCount: g.count
    }));
  };

  const byDiet = {};
  for (const [dietType, rows] of Object.entries(rowsByDiet)) {
    byDiet[dietType] = build(rows);
  }
  return byDiet;
}

function buildScatterPayload(rowsByDiet, sampleSize = 500) {
  const byDiet = {};
  for (const [dietType, rows] of Object.entries(rowsByDiet)) {
    byDiet[dietType] = rows
      .slice(0, sampleSize)
      .map((r) => ({ dietType: r.dietType, protein: r.protein, carbs: r.carbs, fat: r.fat }));
  }
  return byDiet;
}

function buildCorrelationMatrix(rows) {
  const n = rows.length;
  if (n === 0) {
    const zero = {};
    for (const a of DISTINCT_FIELDS) {
      zero[a] = {};
      for (const b of DISTINCT_FIELDS) zero[a][b] = 0;
    }
    return zero;
  }

  const means = {};
  for (const f of DISTINCT_FIELDS) means[f] = average(rows.map((r) => r[f]));

  const matrix = {};
  for (const a of DISTINCT_FIELDS) {
    matrix[a] = {};
    for (const b of DISTINCT_FIELDS) {
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

function buildHeatmapPayload(rowsByDiet) {
  const byDiet = {};
  for (const [dietType, rows] of Object.entries(rowsByDiet)) {
    byDiet[dietType] = buildCorrelationMatrix(rows);
  }
  return byDiet;
}

function buildPiePayload(rows) {
  // Distribution is always computed over the full dataset, not per-diet
  // (a "keto-only" pie chart would be a single 100% slice).
  const distribution = {};
  for (const r of rows) {
    distribution[r.dietType] = (distribution[r.dietType] || 0) + 1;
  }
  return distribution;
}

/**
 * Compute all 4 chart payloads from cleaned rows.
 * Returns the 4 documents ready to upsert into the `results` container.
 */
function computeChartPayloads(rows) {
  const rowsByDiet = { [ALL_KEY]: rows };
  for (const r of rows) {
    if (!rowsByDiet[r.dietType]) rowsByDiet[r.dietType] = [];
    rowsByDiet[r.dietType].push(r);
  }

  return {
    bar: { id: "bar", chartType: "bar", byDiet: buildBarPayload(rowsByDiet) },
    scatter: { id: "scatter", chartType: "scatter", byDiet: buildScatterPayload(rowsByDiet) },
    heatmap: { id: "heatmap", chartType: "heatmap", byDiet: buildHeatmapPayload(rowsByDiet) },
    pie: { id: "pie", chartType: "pie", distribution: buildPiePayload(rows) }
  };
}

module.exports = {
  ALL_KEY,
  parseAndCleanCsv,
  recipeId,
  computeChartPayloads
};
