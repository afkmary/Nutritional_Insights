import React from "react";

const FIELDS = ["protein", "carbs", "fat"];

// Map a correlation value (-1 to 1) to a color intensity
function colorFor(value) {
  const intensity = Math.abs(value);
  const r = value >= 0 ? 79 : 217;
  const g = value >= 0 ? 95 : 119;
  const b = value >= 0 ? 218 : 87;
  const alpha = 0.25 + intensity * 0.65;
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
