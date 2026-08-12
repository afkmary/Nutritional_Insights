import React, { useState } from "react";
import BarChartCard from "./components/BarChartCard.jsx";
import ScatterChartCard from "./components/ScatterChartCard.jsx";
import HeatmapCard from "./components/HeatmapCard.jsx";
import PieChartCard from "./components/PieChartCard.jsx";
import { fetchInsights, fetchRecipes, fetchClusters } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import DashboardExtras from "./DashboardExtras.jsx";

const DIET_TYPES = ["all", "keto", "paleo", "vegan", "mediterranean", "dash"];
const PAGE_SIZE = 10;

function getPageNumbers(current, total) {
  const delta = 2;
  const pages = [];
  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);

  pages.push(1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}

export default function App() {
  const { user, logout } = useAuth();

  const [search, setSearch] = useState("");
  const [dietType, setDietType] = useState("keto");

  const [insights, setInsights] = useState(null);
  const [recipesData, setRecipesData] = useState(null);
  const [clustersData, setClustersData] = useState(null);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState({ insights: false, recipes: false, clusters: false });
  const [lastExecTime, setLastExecTime] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleGetInsights() {
    setLoading((l) => ({ ...l, insights: true }));
    setErrorMsg(null);
    try {
      const data = await fetchInsights(dietType);
      setInsights(data);
      setLastExecTime(data.executionTimeMs);
      setLastUpdated(new Date());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading((l) => ({ ...l, insights: false }));
    }
  }

  async function handleGetRecipes(targetPage = 1) {
    setLoading((l) => ({ ...l, recipes: true }));
    setErrorMsg(null);
    try {
      const data = await fetchRecipes({ diet: dietType, search, page: targetPage, pageSize: PAGE_SIZE });
      setRecipesData(data);
      setPage(targetPage);
      setLastExecTime(data.executionTimeMs);
      setLastUpdated(new Date());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading((l) => ({ ...l, recipes: false }));
    }
  }

  async function handleGetClusters() {
    setLoading((l) => ({ ...l, clusters: true }));
    setErrorMsg(null);
    try {
      const data = await fetchClusters(dietType, 3);
      setClustersData(data);
      setLastExecTime(data.executionTimeMs);
      setLastUpdated(new Date());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading((l) => ({ ...l, clusters: false }));
    }
  }

  // Refresh button: re-pulls insights, recipes (current page/search/diet), and
  // clusters all at once, using whatever filters are currently selected.
  async function handleRefreshAll() {
    setRefreshing(true);
    setErrorMsg(null);
    setLoading({ insights: true, recipes: true, clusters: true });

    const results = await Promise.allSettled([
      fetchInsights(dietType),
      fetchRecipes({ diet: dietType, search, page, pageSize: PAGE_SIZE }),
      fetchClusters(dietType, 3),
    ]);

    const [insightsResult, recipesResult, clustersResult] = results;
    const failures = [];

    if (insightsResult.status === "fulfilled") {
      setInsights(insightsResult.value);
    } else {
      failures.push("insights");
    }

    if (recipesResult.status === "fulfilled") {
      setRecipesData(recipesResult.value);
    } else {
      failures.push("recipes");
    }

    if (clustersResult.status === "fulfilled") {
      setClustersData(clustersResult.value);
    } else {
      failures.push("clusters");
    }

    // Show the slowest of the three execution times, since that's what the
    // browser actually waited on.
    const execTimes = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value.executionTimeMs)
      .filter((t) => typeof t === "number");
    if (execTimes.length > 0) {
      setLastExecTime(Math.max(...execTimes));
    }

    if (failures.length > 0) {
      setErrorMsg(`Refresh failed for: ${failures.join(", ")}`);
    }

    setLastUpdated(new Date());
    setLoading({ insights: false, recipes: false, clusters: false });
    setRefreshing(false);
  }

  const anyLoading = loading.insights || loading.recipes || loading.clusters;

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Nutritional Insights</h1>
        <div className="header-user">
          <span className="header-user-name">{user.displayName}</span>
          <button className="btn btn-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="main">
        <h2 className="section-title">Explore Nutritional Insights</h2>
        <div className="chart-grid">
          <BarChartCard insights={insights?.insights} loading={loading.insights} />
          <ScatterChartCard insights={insights} loading={loading.insights} />
          <HeatmapCard insights={insights} loading={loading.insights} />
          <PieChartCard distribution={recipesData?.distribution} loading={loading.recipes} />
        </div>

        <h2 className="section-title">Filters and Data Interaction</h2>
        <div className="filters-row">
          <input
            type="text"
            placeholder="Search by Recipe Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={dietType} onChange={(e) => setDietType(e.target.value)}>
            {DIET_TYPES.map((d) => (
              <option key={d} value={d}>{d === "all" ? "All Diets" : d[0].toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
          <button
            className="btn btn-refresh"
            onClick={handleRefreshAll}
            disabled={anyLoading}
            title="Re-fetch insights, recipes, and clusters using the current filters"
          >
            {refreshing ? "Refreshing…" : "⟳ Refresh All Data"}
          </button>
        </div>

        <h2 className="section-title">API Data Interaction</h2>
        <div className="api-buttons">
          <button className="btn btn-insights" onClick={handleGetInsights} disabled={anyLoading}>
            Get Nutritional Insights
          </button>
          <button className="btn btn-recipes" onClick={() => handleGetRecipes(1)} disabled={anyLoading}>
            Get Recipes
          </button>
          <button className="btn btn-clusters" onClick={handleGetClusters} disabled={anyLoading}>
            Get Clusters
          </button>
        </div>

        <DashboardExtras />

        {errorMsg && (
          <p className="meta-note" style={{ color: "#c0392b" }}>Error: {errorMsg}</p>
        )}
        {lastExecTime !== null && (
          <p className="meta-note">
            Last function execution time: {lastExecTime}ms
            {lastUpdated && ` · Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        )}

        <h2 className="section-title">Pagination</h2>
        <div className="pagination">
          <button
            className="page-btn"
            disabled={!recipesData || page <= 1}
            onClick={() => handleGetRecipes(page - 1)}
          >
            Previous
          </button>
          {recipesData &&
            getPageNumbers(page, recipesData.totalPages).map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`page-btn ${p === page ? "active" : ""}`}
                  onClick={() => handleGetRecipes(p)}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="page-btn"
            disabled={!recipesData || page >= recipesData.totalPages}
            onClick={() => handleGetRecipes(page + 1)}
          >
            Next
          </button>
        </div>
      </main>

      <footer className="footer">
        © 2026 Nutritional Insights. All Rights Reserved.
      </footer>
    </div>
  );
}
