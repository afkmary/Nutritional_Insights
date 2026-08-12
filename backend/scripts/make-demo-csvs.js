// Generates demo/All_Diets_v1.csv and demo/All_Diets_v2.csv from an existing All_Diets.csv

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("Usage: node scripts/make-demo-csvs.js /path/to/All_Diets.csv");
  process.exit(1);
}

const outDir = path.join(__dirname, "..", "demo");
fs.mkdirSync(outDir, { recursive: true });

const raw = fs.readFileSync(srcPath, "utf8");

// v1: untouched copy
fs.writeFileSync(path.join(outDir, "All_Diets_v1.csv"), raw);

// v2: bump every keto row's Protein(g) by +25, plus one obviously-fake recipe
// so the diff is unmistakable on camera.
const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
const columns = Object.keys(records[0]);

let bumped = 0;
for (const r of records) {
  if ((r.Diet_type || "").trim().toLowerCase() === "keto") {
    r["Protein(g)"] = ((parseFloat(r["Protein(g)"]) || 0) + 25).toFixed(2);
    bumped++;
  }
}

const demoRow = Object.fromEntries(columns.map((c) => [c, ""]));
Object.assign(demoRow, {
  Diet_type: "keto",
  Recipe_name: "DEMO Phase3 Test Recipe",
  Cuisine_type: "american",
  "Protein(g)": "999",
  "Carbs(g)": "1",
  "Fat(g)": "1",
  Extraction_day: "2026-01-01",
  Extraction_time: "00:00:00"
});
records.push(demoRow);

fs.writeFileSync(
  path.join(outDir, "All_Diets_v2.csv"),
  stringify(records, { header: true, columns })
);

console.log(`Wrote:
  ${path.join(outDir, "All_Diets_v1.csv")}   (${records.length - 1} rows, untouched)
  ${path.join(outDir, "All_Diets_v2.csv")}   (${bumped} keto rows bumped +25, 1 demo row appended)
`);
