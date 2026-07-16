import React, { useState } from "react";
import BarChartCard from "./components/BarChartCard.jsx";
import ScatterChartCard from "./components/ScatterChartCard.jsx";
import HeatmapCard from "./components/HeatmapCard.jsx";
import PieChartCard from "./components/PieChartCard.jsx";
import { fetchInsights, fetchRecipes, fetchClusters } from "./api.js";

const DIET_TYPES = ["all", "keto", "paleo", "vegan", "mediterranean", "dash"];
const PAGE_SIZE = 10;

export default function App() {
  const [search, setSearch] = useState("");
  const [dietType, setDietType] = useState("keto");

  const [insights, setInsights] = useState(null);
  const [recipesData, setRecipesData] = useState(null);
  const [clustersData, setClustersData] = useState(null);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState({ insights: false, recipes: false, clusters: false });
  const [lastExecTime, setLastExecTime] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleGetInsights() {
    setLoading((l) => ({ ...l, insights: true }));
    setErrorMsg(null);
    try {
      const data = await fetchInsights(dietType);
      setInsights(data);
      setLastExecTime(data.executionTimeMs);
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
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading((l) => ({ ...l, clusters: false }));
    }
  }

  const anyLoading = loading.insights || loading.recipes || loading.clusters;

  return (
    <div>
      <header className="header">
        <h1>Nutritional Insights</h1>
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

        {errorMsg && (
          <p className="meta-note" style={{ color: "#c0392b" }}>Error: {errorMsg}</p>
        )}
        {lastExecTime !== null && !errorMsg && (
          <p className="meta-note">Last function execution time: {lastExecTime}ms</p>
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
            Array.from({ length: recipesData.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`page-btn ${p === page ? "active" : ""}`}
                onClick={() => handleGetRecipes(p)}
              >
                {p}
              </button>
            ))}
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
