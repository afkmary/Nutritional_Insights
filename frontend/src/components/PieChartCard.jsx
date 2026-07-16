import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const DIET_COLORS = {
  paleo: "#FFB8B0",
  vegan: "#B4E8D4",
  keto: "#C9BFF0",
  mediterranean: "#A9D8F0",
  dash: "#FFD9A8"
};

export default function PieChartCard({ distribution, loading }) {
  const data = Object.entries(distribution || {}).map(([dietType, count]) => ({
    name: dietType,
    value: count
  }));

  return (
    <div className="card">
      <h3>Pie Chart</h3>
      <p>Recipe distribution by diet type.</p>
      <div className="card-body">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : data.length === 0 ? (
          <div className="empty-state">No data yet — click "Get Recipes"</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={DIET_COLORS[entry.name] || "#999"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
