# Diet Analysis Function — Setup & Deploy

This function reads `All_Diets.csv` from your Azure Blob Storage container and
exposes 3 HTTP endpoints that power the dashboard:

| Endpoint | Route | Powers |
|---|---|---|
| Get Nutritional Insights | `GET /api/insights?diet=keto` | Bar Chart, Scatter Plot, Heatmap |
| Get Recipes | `GET /api/recipes?diet=keto&search=chicken&page=1&pageSize=10` | Pie Chart, Search filter, Pagination |
| Get Clusters | `GET /api/clusters?diet=keto&k=3` | Get Clusters button |

All endpoints also return `executionTimeMs` — use that for the "function
execution time" metadata requirement.

## 1. Install dependencies

In this folder, run:
```powershell
npm install
```

## 2. Upload the dataset (if you haven't already)

Your storage account/container are already set up (`dietanalysisstorage77` /
`diet-data`). Make sure `All_Diets.csv` is the blob name — that's what the
code looks for by default (`DIET_STORAGE_BLOB` setting).

```powershell
az storage blob upload --account-name dietanalysisstorage77 --container-name diet-data --name All_Diets.csv --file "C:\path\to\archive\All_Diets.csv" --auth-mode key
```
(Skip this if you already uploaded it earlier.)

## 3. Fill in `local.settings.json`

Get your connection string:
```powershell
az storage account show-connection-string --name dietanalysisstorage77 --resource-group diet-analysis-rg --query connectionString -o tsv
```
Paste it into `local.settings.json` in place of `PASTE_YOUR_CONNECTION_STRING_HERE`.

## 4. Test locally (optional but recommended)

```powershell
func start
```
Then visit `http://localhost:7071/api/insights` in your browser — you should
see JSON with `avgProtein`/`avgCarbs`/`avgFat` per diet type.

## 5. Set the same connection string in the cloud

```powershell
az functionapp config appsettings set --name diet-analysis-func-marya --resource-group diet-analysis-rg --settings "AzureWebJobsStorage=PASTE_SAME_CONNECTION_STRING_HERE"
```

## 6. Deploy

```powershell
func azure functionapp publish diet-analysis-func-marya
```

## 7. Test the live endpoints

```
https://diet-analysis-func-marya.azurewebsites.net/api/insights
https://diet-analysis-func-marya.azurewebsites.net/api/recipes?page=1&pageSize=10
https://diet-analysis-func-marya.azurewebsites.net/api/clusters?k=3
```

Send these 3 URLs to your teammate — that's the "contract" the frontend
needs to fetch from.
