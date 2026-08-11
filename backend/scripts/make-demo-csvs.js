// Generates demo/All_Diets_v1.csv and demo/All_Diets_v2.csv from an existing
// All_Diets.csv so you have two versions with a clearly visible difference
// for the live demo (upload v1 -> compute fires once; refresh dashboard 10x
// -> zero compute; upload v2 -> compute fires once more with new numbers).
//
// Usage: node scripts/make-demo-csvs.js /path/to/All_Diets.csv
//
// NOTE: this uses csv-parse / csv-stringify rather than line.split(",").
// 543 rows in All_Diets.csv contain quoted fields with embedded commas
// (e.g. `paleo,"Paleo Effect Asian-Glazed Pork Sides, A Sweet & Crispy
// Appetizer",...`). Splitting those on "," shifts every column after the
// recipe name, which silently corrupts the row instead of erroring.

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

// Build the demo row from the real header so it can never drift out of sync
// with the column count. A short row (6 fields against an 8-column header)
// makes csv-parse throw CSV_RECORD_INCONSISTENT_COLUMNS, which would kill the
// whole ETL run rather than just skipping that row.
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

Sanity check before you record:
  node -e "
  const {parse}=require('csv-parse/sync');const fs=require('fs');
  for (const v of ['v1','v2']) {
    const rows=parse(fs.readFileSync('demo/All_Diets_'+v+'.csv','utf8'),{columns:true,skip_empty_lines:true,trim:true});
    const keto=rows.filter(r=>r.Diet_type.toLowerCase()==='keto');
    const avg=keto.reduce((s,r)=>s+parseFloat(r['Protein(g)']||0),0)/keto.length;
    console.log(v, rows.length+' rows, keto avgProtein='+avg.toFixed(2));
  }"

  -> v2 keto avgProtein should be ~25 higher than v1 (plus a nudge from the 999 demo row).

Demo script:
  1. az storage blob upload --account-name <acct> --container-name diet-data \\
       --name All_Diets.csv --file demo/All_Diets_v1.csv --auth-mode key --overwrite
     -> watch logs: onDietsCsvChange fires once
  2. Refresh the dashboard 10x -> zero new "onDietsCsvChange" log lines, only HTTP function logs
  3. az storage blob upload --account-name <acct> --container-name diet-data \\
       --name All_Diets.csv --file demo/All_Diets_v2.csv --auth-mode key --overwrite
     -> onDietsCsvChange fires once more, keto avgProtein visibly jumps,
        "DEMO Phase3 Test Recipe" appears in /api/recipes?diet=keto&q=demo
`);
