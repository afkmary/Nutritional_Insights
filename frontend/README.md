# Nutritional Insights Dashboard

React + Vite dashboard that consumes the deployed Azure Function
(`diet-analysis-func-marya`). Matches the approved mockup: bar chart,
scatter plot, heatmap, pie chart, filters, API buttons, and pagination.

## Run it locally

```powershell
npm install
npm run dev
```
Opens at `http://localhost:5173`. Click "Get Nutritional Insights" and
"Get Recipes" to load real data from the live Azure Function.

## Where things live

- `src/api.js` — the ONLY file with the Function URL in it (`FUNCTION_BASE_URL`).
  If the backend URL ever changes, this is the one line to update.
- `src/App.jsx` — page layout, state, and button/filter/pagination logic.
- `src/components/` — one file per chart (Bar, Scatter, Heatmap, Pie).

## Push to GitHub

```powershell
git init
git add .
git commit -m "Person A: dashboard layout + charts wired to live Function"
git branch -M main
git remote add origin <your-shared-repo-url>
git push -u origin main
```

## Handoff notes for Person B

- The 4 charts and layout scaffold are done and wired to real data —
  build the remaining interaction polish (better search UX, extra
  filters, deploy to Azure Static Web App) on top of this.
- `fetchDashboardData`-style calls are split into `fetchInsights`,
  `fetchRecipes`, and `fetchClusters` in `src/api.js` — reuse these,
  don't duplicate fetch logic elsewhere.
- Deployment (Static Web App / App Service + public link) is still
  outstanding — that's Person B's task per the checklist.
