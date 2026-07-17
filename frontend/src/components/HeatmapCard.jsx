import React from "react";

const FIELDS = ["protein", "carbs", "fat"];

// Map a correlation value (-1 to 1) to a pastel color intensity
// Positive correlations -> lilac, negative -> peach
function colorFor(value) {
  const intensity = Math.abs(value);
  const r = value >= 0 ? 201 : 255;
  const g = value >= 0 ? 191 : 217;
  const b = value >= 0 ? 240 : 168;
  const alpha = 0.35 + intensity * 0.55;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function HeatmapCard({ insights, loading }) {
  const matrix = insights?.correlation;

  return (
    <div className="card">
      <h3>Heatmap</h3>
      <p>Nutrient correlations.</p>
      <div className="card-body">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : !matrix ? (
          <div className="empty-state">No data yet — click "Get Nutritional Insights"</div>
        ) : (
          <div className="heatmap-grid">
            <div />
            {FIELDS.map((f) => (
              <div key={f} className="heatmap-label">{f}</div>
            ))}
            {FIELDS.map((rowField) => (
              <React.Fragment key={rowField}>
                <div className="heatmap-label">{rowField}</div>
                {FIELDS.map((colField) => {
                  const value = matrix[rowField]?.[colField] ?? 0;
                  return (
                    <div
                      key={colField}
                      className="heatmap-cell"
                      style={{ background: colorFor(value) }}
                      title={`${rowField} vs ${colField}: ${value}`}
                    >
                      {value.toFixed(2)}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
