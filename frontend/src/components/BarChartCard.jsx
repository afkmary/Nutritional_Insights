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
              <Bar dataKey="avgProtein" fill="#C9BFF0" name="Protein (g)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="avgCarbs" fill="#B4E8D4" name="Carbs (g)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="avgFat" fill="#FFD9A8" name="Fat (g)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
