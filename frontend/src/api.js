// Base URL of the deployed Azure Function (Person A's backend).
// This is the ONE line that needs to change if the function URL ever changes.
export const FUNCTION_BASE_URL = "https://diet-analysis-func-marya.azurewebsites.net/api";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return res.json();
}

export async function fetchInsights(diet) {
  const params = new URLSearchParams();
  if (diet && diet !== "all") params.set("diet", diet);
  return getJson(`${FUNCTION_BASE_URL}/insights?${params.toString()}`);
}

export async function fetchRecipes({ diet, search, page = 1, pageSize = 10 }) {
  const params = new URLSearchParams();
  if (diet && diet !== "all") params.set("diet", diet);
  if (search) params.set("search", search);
  params.set("page", page);
  params.set("pageSize", pageSize);
  return getJson(`${FUNCTION_BASE_URL}/recipes?${params.toString()}`);
}

export async function fetchClusters(diet, k = 3) {
  const params = new URLSearchParams();
  if (diet && diet !== "all") params.set("diet", diet);
  params.set("k", k);
  return getJson(`${FUNCTION_BASE_URL}/clusters?${params.toString()}`);
}
