from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent
PARQUET_PATH = ROOT / "cell_metadata_umap.parquet"
PRIVATE_COLUMNS = {"source_path"}
MAX_LIMIT = 300_000
DENSE_LIMIT = 100_000
DEFAULT_LIMIT = 100_000
UNKNOWN = "Unknown"
LIGHT_COLUMNS = [
    "Cell ID",
    "cell_id",
    "UMAP_1",
    "UMAP_2",
    "Group",
    "Origin",
    "Dataset",
    "Sample",
    "Sex",
    "Age group",
    "SLEDAI source",
    "Major cell type",
    "Cell subtype",
    "Age",
    "SLEDAI",
]
CATEGORICAL_FIELDS = [
    "Group",
    "Origin",
    "Dataset",
    "Sample",
    "Sex",
    "Age group",
    "SLEDAI source",
    "Major cell type",
    "Cell subtype",
]
NUMERIC_FIELDS = [
    "Age",
    "SLEDAI",
]


class NumericRange(BaseModel):
    min: float
    max: float


class QueryRequest(BaseModel):
    categorical: dict[str, list[str]] = Field(default_factory=dict)
    numeric: dict[str, NumericRange] = Field(default_factory=dict)
    limit: int = DEFAULT_LIMIT
    offset: int = 0
    columns: list[str] | None = None


class SummaryRowsRequest(BaseModel):
    categorical: dict[str, list[str]] = Field(default_factory=dict)
    numeric: dict[str, NumericRange] = Field(default_factory=dict)
    mode: str = "sample"


class DenseUmapRequest(BaseModel):
    categorical: dict[str, list[str]] = Field(default_factory=dict)
    numeric: dict[str, NumericRange] = Field(default_factory=dict)
    limit: int = 50_000
    offset: int = 0
    color_by: str | None = None


class DenseColorRequest(BaseModel):
    categorical: dict[str, list[str]] = Field(default_factory=dict)
    numeric: dict[str, NumericRange] = Field(default_factory=dict)
    limit: int = 50_000
    offset: int = 0
    color_by: str


app = FastAPI(
    title="SLE Single-cell Atlas API",
    description="Backend API for serving full SLE single-cell parquet data to the atlas browser.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://localhost:5173",
        "http://localhost:5175",
        "http://sleca-repository.com",
        "http://www.sleca-repository.com",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|sleca-repository\.com|www\.sleca-repository\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_df: pd.DataFrame | None = None


def data_frame() -> pd.DataFrame:
    global _df
    if _df is None:
        if not PARQUET_PATH.exists():
            raise FileNotFoundError(f"Missing parquet file: {PARQUET_PATH}")
        _df = pd.read_parquet(PARQUET_PATH)
        for column in PRIVATE_COLUMNS.intersection(_df.columns):
            _df = _df.drop(columns=[column])
        if "Cell ID" in _df.columns and "cell_id" not in _df.columns:
            _df["cell_id"] = _df["Cell ID"]
    return _df


@app.get("/api/health")
def health() -> dict[str, Any]:
    df = data_frame()
    return {
        "ok": True,
        "source": PARQUET_PATH.name,
        "rows": int(len(df)),
        "columns": list(df.columns),
    }


@app.post("/api/cells/query")
def query_cells(request: QueryRequest) -> dict[str, Any]:
    df = data_frame()
    mask = build_filter_mask(df, request)
    filtered = df.loc[mask]
    sampled = chunk_or_sample(filtered, request)

    return {
        "source": PARQUET_PATH.name,
        "total_rows": int(len(df)),
        "filtered_rows": int(len(filtered)),
        "returned_rows": int(len(sampled)),
        "rows": to_json_rows(light_frame(sampled, request.columns)),
    }


@app.post("/api/umap/dense")
def dense_umap(request: DenseUmapRequest) -> dict[str, Any]:
    df = data_frame()
    mask = build_filter_mask(df, request)
    filtered = df.loc[mask]
    limit = max(1, min(int(request.limit), DENSE_LIMIT))
    offset = max(0, int(request.offset))
    chunk = filtered.iloc[offset : offset + limit]

    x = pd.to_numeric(chunk["UMAP_1"], errors="coerce")
    y = pd.to_numeric(chunk["UMAP_2"], errors="coerce")
    valid = x.notna() & y.notna()
    x = x.loc[valid]
    y = y.loc[valid]
    valid_chunk = chunk.loc[valid]

    bounds_x = pd.to_numeric(filtered["UMAP_1"], errors="coerce")
    bounds_y = pd.to_numeric(filtered["UMAP_2"], errors="coerce")
    min_x = float(bounds_x.min())
    max_x = float(bounds_x.max())
    min_y = float(bounds_y.min())
    max_y = float(bounds_y.max())

    id_column = "cell_id" if "cell_id" in valid_chunk.columns else "Cell ID"
    cell_ids = valid_chunk[id_column].where(pd.notna(valid_chunk[id_column]), None).tolist() if id_column in valid_chunk.columns else []
    color_values = []
    if request.color_by and request.color_by in valid_chunk.columns:
        color_series = valid_chunk.loc[valid, request.color_by].where(pd.notna(valid_chunk.loc[valid, request.color_by]), UNKNOWN)
        color_values = color_series.tolist()

    return {
        "source": PARQUET_PATH.name,
        "total_rows": int(len(df)),
        "filtered_rows": int(len(filtered)),
        "returned_rows": int(len(valid_chunk)),
        "offset": offset,
        "x": x.astype(float).tolist(),
        "y": y.astype(float).tolist(),
        "cell_id": cell_ids,
        "color": color_values,
        "bounds": {
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
        },
    }


@app.post("/api/umap/colors")
def dense_umap_colors(request: DenseColorRequest) -> dict[str, Any]:
    df = data_frame()
    mask = build_filter_mask(df, request)
    filtered = df.loc[mask]
    limit = max(1, min(int(request.limit), DENSE_LIMIT))
    offset = max(0, int(request.offset))
    chunk = filtered.iloc[offset : offset + limit]

    x = pd.to_numeric(chunk["UMAP_1"], errors="coerce")
    y = pd.to_numeric(chunk["UMAP_2"], errors="coerce")
    valid = x.notna() & y.notna()
    valid_chunk = chunk.loc[valid]
    color_values = []
    if request.color_by in valid_chunk.columns:
        color_series = valid_chunk[request.color_by].where(pd.notna(valid_chunk[request.color_by]), UNKNOWN)
        color_values = color_series.tolist()

    return {
        "source": PARQUET_PATH.name,
        "total_rows": int(len(df)),
        "filtered_rows": int(len(filtered)),
        "returned_rows": int(len(valid_chunk)),
        "offset": offset,
        "color": color_values,
    }


@app.post("/api/filters/summary")
def filter_summary(request: QueryRequest) -> dict[str, Any]:
    df = data_frame()
    mask = build_filter_mask(df, request)
    filtered = df.loc[mask]

    return make_filter_summary(df, filtered)


@app.post("/api/filters/facets")
def filter_facets(request: QueryRequest) -> dict[str, Any]:
    df = data_frame()
    categorical = {}
    for field in CATEGORICAL_FIELDS:
        if field not in df.columns:
            continue
        mask = build_filter_mask(df, request, ignore_categorical_field=field)
        filtered = df.loc[mask]
        counts = filtered[field].astype("string").fillna(UNKNOWN).value_counts(dropna=False).head(200)
        categorical[field] = [{"label": str(label), "count": int(count)} for label, count in counts.items()]

    return {
        "total_rows": int(len(df)),
        "filtered_rows": int(build_filter_mask(df, request).sum()),
        "unique": {},
        "categorical": categorical,
        "numeric": {},
    }


def make_filter_summary(df: pd.DataFrame, filtered: pd.DataFrame) -> dict[str, Any]:
    categorical = {}
    for field in CATEGORICAL_FIELDS:
        if field not in filtered.columns:
            continue
        counts = filtered[field].astype("string").fillna(UNKNOWN).value_counts(dropna=False).head(200)
        categorical[field] = [{"label": str(label), "count": int(count)} for label, count in counts.items()]

    numeric = {}
    for field in NUMERIC_FIELDS:
        if field not in filtered.columns:
            continue
        series = pd.to_numeric(filtered[field], errors="coerce").dropna()
        if series.empty:
            continue
        hist_counts, bin_edges = np.histogram(series.to_numpy(), bins=18)
        numeric[field] = {
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "bins": [
                {
                    "label": f"{bin_edges[index]:.2f}-{bin_edges[index + 1]:.2f}",
                    "min": float(bin_edges[index]),
                    "max": float(bin_edges[index + 1]),
                    "count": int(hist_counts[index]),
                }
                for index in range(len(hist_counts))
            ],
        }

    return {
        "total_rows": int(len(df)),
        "filtered_rows": int(len(filtered)),
        "unique": {
            "Sample": int(filtered["Sample"].dropna().nunique()) if "Sample" in filtered.columns else 0,
            "Origin": int(filtered["Origin"].dropna().nunique()) if "Origin" in filtered.columns else 0,
            "Dataset": int(filtered["Dataset"].dropna().nunique()) if "Dataset" in filtered.columns else 0,
        },
        "categorical": categorical,
        "numeric": numeric,
    }


@app.post("/api/summary/rows")
def summary_rows(request: SummaryRowsRequest) -> dict[str, Any]:
    df = data_frame()
    mask = build_filter_mask(df, request)
    filtered = df.loc[mask]
    mode = "origin" if request.mode == "patient" else "sample"
    group_field = "Origin" if mode == "origin" else "Sample"
    if group_field not in filtered.columns:
        return {"mode": request.mode, "rows": []}

    rows = []
    for key, group in filtered.groupby(group_field, dropna=False, sort=False):
        top_cell_types = (
            group["Cell subtype"].astype("string").fillna(UNKNOWN).value_counts().head(3).index.tolist()
            if "Cell subtype" in group.columns
            else []
        )

        if mode == "origin":
            row = {
                "origin": value_or_unknown(key),
                "group": first_group_value(group, "Group"),
                "cell_count": int(len(group)),
                "n_samples": int(group["Sample"].dropna().nunique()) if "Sample" in group.columns else 0,
                "n_cell_types": int(group["Cell subtype"].dropna().nunique()) if "Cell subtype" in group.columns else 0,
                "top_cell_types": ", ".join(map(str, top_cell_types)),
                "Age": first_group_value(group, "Age"),
                "Age group": first_group_value(group, "Age group"),
                "Sex": first_group_value(group, "Sex"),
                "SLEDAI": first_group_value(group, "SLEDAI"),
                "SLEDAI source": first_group_value(group, "SLEDAI source"),
            }
        else:
            row = {
                "sample": value_or_unknown(key),
                "dataset": first_group_value(group, "Dataset"),
                "origin": first_group_value(group, "Origin"),
                "group": first_group_value(group, "Group"),
                "cell_count": int(len(group)),
                "n_cell_types": int(group["Cell subtype"].dropna().nunique()) if "Cell subtype" in group.columns else 0,
                "top_cell_types": ", ".join(map(str, top_cell_types)),
                "Age": first_group_value(group, "Age"),
                "Age group": first_group_value(group, "Age group"),
                "Sex": first_group_value(group, "Sex"),
                "SLEDAI": first_group_value(group, "SLEDAI"),
            }
        rows.append(row)

    rows.sort(key=lambda row: int(row["cell_count"]), reverse=True)
    return {"mode": request.mode, "rows": rows}


@app.get("/api/cells/{cell_id}")
def cell_metadata(cell_id: str) -> dict[str, Any]:
    df = data_frame()
    id_column = "cell_id" if "cell_id" in df.columns else "Cell ID"
    if id_column not in df.columns:
        return {"cell": None}

    matches = df.loc[df[id_column].astype("string") == str(cell_id)]
    if matches.empty:
        return {"cell": None}

    return {"cell": to_json_rows(matches.head(1))[0]}


def build_filter_mask(
    df: pd.DataFrame,
    request: QueryRequest | DenseUmapRequest,
    ignore_categorical_field: str | None = None,
) -> pd.Series:
    mask = pd.Series(True, index=df.index)
    for field, values in request.categorical.items():
        if field == ignore_categorical_field:
            continue
        if field in df.columns and values:
            series = df[field].astype("string").fillna(UNKNOWN)
            mask &= series.isin(values)

    for field, value_range in request.numeric.items():
        if field in df.columns:
            series = pd.to_numeric(df[field], errors="coerce")
            mask &= series.ge(value_range.min) & series.le(value_range.max)

    return mask


def chunk_or_sample(frame: pd.DataFrame, request: QueryRequest) -> pd.DataFrame:
    limit = max(1, min(int(request.limit), MAX_LIMIT))
    offset = max(0, int(request.offset))
    if offset > 0:
        return frame.iloc[offset : offset + limit]

    if len(frame) <= limit:
        return frame

    step = max(1, len(frame) // limit)
    return frame.iloc[::step].head(limit)


def light_frame(frame: pd.DataFrame, requested_columns: list[str] | None = None) -> pd.DataFrame:
    allowed = requested_columns or LIGHT_COLUMNS
    columns = [column for column in allowed if column in frame.columns and column not in PRIVATE_COLUMNS]
    return frame.loc[:, columns]


def to_json_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    clean = frame.where(pd.notna(frame), None)
    return clean.to_dict(orient="records")


def value_or_unknown(value: Any) -> Any:
    if pd.isna(value):
        return UNKNOWN
    return value


def first_group_value(group: pd.DataFrame, column: str) -> Any:
    if column not in group.columns:
        return UNKNOWN
    values = group[column].dropna()
    if values.empty:
        return UNKNOWN
    return value_or_unknown(values.iloc[0])
