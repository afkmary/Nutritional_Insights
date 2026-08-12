// For local development against `func start`, switch this to:
//   "http://localhost:7071/api"
export const FUNCTION_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://diet-analysis-func-marya.azurewebsites.net/api";

// --- session token -------------------------------------------------------
// Held in a module variable rather than localStorage. AuthContext is the only
// thing that sets it; every request below picks it up automatically, so there
// is exactly one place that knows how a request is authenticated.

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

/** AuthContext registers a callback here so a 401 anywhere logs the user out. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function authHeaders(extra = {}) {
  return authToken
    ? { ...extra, Authorization: `Bearer ${authToken}` }
    : { ...extra };
}

async function getJson(url) {
  const res = await fetch(url, { headers: authHeaders() });

  if (res.status === 401) {
    // Token expired or missing — drop the session so the app falls back to
    // the login screen instead of showing an empty dashboard.
    authToken = null;
    if (onUnauthorized) onUnauthorized();
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return res.json();
}

// --- dashboard data ------------------------------------------------------

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

// --- auth ----------------------------------------------------------------

/** Shared POST helper that surfaces the API's own error message. */
async function postAuth(path, body) {
  const res = await fetch(`${FUNCTION_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function register({ email, password, displayName }) {
  return postAuth("/auth/register", { email, password, displayName });
}

export function login({ email, password }) {
  return postAuth("/auth/login", { email, password });
}

/** Full page navigation — the OAuth flow needs real browser redirects. */
export function startGithubLogin() {
  window.location.href = `${FUNCTION_BASE_URL}/auth/github/start`;
}
