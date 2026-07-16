import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function BarChartCard({ insights, loading }) {
  return (
    <div className="card">
      <h3>Bar Chart</h3>
      <p>Average macronutrient content by diet type.</p>
      <div className="card-body">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : !insights || insights.length === 0 ? (
          <div className="empty-state">No data yet — click "Get Nutritional Insights"</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={insights}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dietType" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="avgProtein" fill="#4F5FDA" name="Protein (g)" />
              <Bar dataKey="avgCarbs" fill="#4C8C5B" name="Carbs (g)" />
              <Bar dataKey="avgFat" fill="#7C5CBF" name="Fat (g)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
