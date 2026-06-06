# SLE Single-cell Atlas Browser

Interactive React app for exploring SLE single-cell metadata, clinical annotations, and UMAP embeddings.

## Install

```bash
npm install
```

## Run Preview Frontend Only

```bash
npm run dev
```

Open the printed local URL, usually `http://localhost:5173`.

## Run Full Parquet Version

Create and manage the Python environment yourself. The backend assumes an environment with:

- `fastapi`
- `uvicorn`
- `pandas`
- `pyarrow`

Start the parquet API:

```powershell
conda activate sleca_api
cd D:\desktop\SLECA_web
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

In another terminal, start the frontend:

```powershell
cd D:\desktop\SLECA_web
npm run dev -- --host 127.0.0.1 --port 5175
```

Open `http://127.0.0.1:5175/`.

## Data Files

Keep the data files in the project root so Vite can serve them from `/`:

- `cell_metadata_umap_preview.csv`
- `cell_metadata_umap.csv.gz`
- `cell_metadata_umap.parquet`

The production app defaults to the `Parquet API`, which reads `cell_metadata_umap.parquet` through the lightweight FastAPI backend. `cell_metadata_umap_preview.csv` remains available from the data source selector for quick UI debugging.

For a production build, serve the same files from the deployed web root or copy them into Vite's `public/` folder before building.

## Switching Preview / Full Data

Use the header data source selector:

- `Preview CSV`: loads `cell_metadata_umap_preview.csv`
- `Compressed CSV`: loads `cell_metadata_umap.csv.gz`
- `Parquet API`: loads `cell_metadata_umap.parquet` through `http://127.0.0.1:8000`

If the browser becomes slow on full data, use the sampling selector in the header:

- Preview mode
- Sample 100k cells
- Sample 300k cells
- Max 300k render

Filtering still runs on the loaded rows; sampling controls how many points are drawn in the WebGL UMAP.

## Parquet Notes

The production path uses FastAPI plus pandas/pyarrow to read parquet server-side. Browser-side parquet reading was avoided because WASM parquet engines add startup cost and still put memory pressure on the user browser. The API applies filters against the full parquet table and returns a sampled result set for UMAP rendering, plus exact total and filtered row counts.

For performance, `/api/cells/query` returns a lightweight row shape for UMAP rendering rather than every metadata column. A clicked cell's full metadata is loaded on demand from `/api/cells/{cell_id}`.

`Million batched` is an experimental dense UMAP mode. It uses `/api/umap/dense`, which returns column-oriented arrays (`x`, `y`, `cell_id`) in 50k-point chunks. The frontend writes those chunks into a preallocated `Float32Array` and renders black points with a native WebGL canvas instead of Plotly or React row objects. It progressively appends up to 1,000,000 rendered points and is intended for inspecting the global UMAP shape; color, hover richness, dashboards, and sidebar summaries remain better suited to the 100k/300k modes.

## Privacy Defaults

- `Patient_ID` and `Participant` are displayed through anonymized aliases such as `P001`.
- `source_path` is excluded from exported filtered cell CSVs and selected-cell metadata.
- Race, ethnicity, and skin lesion location fields are not shown in the default metadata panel if present.
