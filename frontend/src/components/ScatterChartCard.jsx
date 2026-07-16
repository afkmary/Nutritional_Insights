import React from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ZAxis } from "recharts";

const DIET_COLORS = {
  paleo: "#4F5FDA",
  vegan: "#4C8C5B",
  keto: "#7C5CBF",
  mediterranean: "#D97757",
  dash: "#E0B84C"
};

export default function ScatterChartCard({ insights, loading }) {
  const points = (insights?.scatterSample || []);
  const byDiet = points.reduce((acc, p) => {
    (acc[p.dietType] = acc[p.dietType] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="card">
      <h3>Scatter Plot</h3>
      <p>Nutrient relationships (e.g., protein vs carbs).</p>
      <div className="card-body">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : points.length === 0 ? (
          <div className="empty-state">No data yet — click "Get Nutritional Insights"</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" dataKey="protein" name="Protein (g)" tick={{ fontSize: 11 }} />
              <YAxis type="number" dataKey="carbs" name="Carbs (g)" tick={{ fontSize: 11 }} />
              <ZAxis range={[40, 40]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              {Object.entries(byDiet).map(([diet, pts]) => (
                <Scatter key={diet} name={diet} data={pts} fill={DIET_COLORS[diet] || "#999"} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
