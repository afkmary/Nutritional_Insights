const { BlobServiceClient } = require("@azure/storage-blob");
const { parse } = require("csv-parse/sync");

// Simple in-memory cache so we don't re-download/re-parse the CSV on every
// single request (the function stays "warm" between calls for a while).
let cachedRows = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadDietData() {
  const now = Date.now();
  if (cachedRows && now - cachedAt < CACHE_TTL_MS) {
    return cachedRows;
  }

  const connStr = process.env.AzureWebJobsStorage;
  const containerName = process.env.DIET_STORAGE_CONTAINER || "diet-data";
  const blobName = process.env.DIET_STORAGE_BLOB || "All_Diets.csv";

  if (!connStr) {
    throw new Error(
      "AzureWebJobsStorage is not set. Check local.settings.json (local) or Function App settings (cloud)."
    );
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download();
  const csvText = await streamToString(downloadResponse.readableStreamBody);

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  // Normalize into a consistent shape regardless of the raw CSV headers
  const rows = records.map((r) => ({
    dietType: r.Diet_type,
    recipeName: r.Recipe_name,
    cuisineType: r.Cuisine_type,
    protein: parseFloat(r["Protein(g)"]) || 0,
    carbs: parseFloat(r["Carbs(g)"]) || 0,
    fat: parseFloat(r["Fat(g)"]) || 0
  }));

  cachedRows = rows;
  cachedAt = now;
  return rows;
}

function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    readableStream.on("error", reject);
  });
}

module.exports = { loadDietData };
