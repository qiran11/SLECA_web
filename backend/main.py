from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent
PARQUET_PATH = ROOT / "cell_metadata_umap.parquet"
PRIVATE_COLUMNS = {"source_path"}
MAX_LIMIT = 300_000
DEFAULT_LIMIT = 100_000
UNKNOWN = "Unknown"
LIGHT_COLUMNS = [
    "cell_id",
    "UMAP_1",
    "UMAP_2",
    "group",
    "dataset",
    "sample",
    "sex",
    "cell_type_merge",
    "cell_type_major_n",
    "Age",
    "SLEDAI",
    "pct_counts_mt",
    "total_counts",
    "n_genes_by_counts",
    "doublet_scores",
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
    ],
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


@app.get("/api/cells/{cell_id}")
def cell_metadata(cell_id: str) -> dict[str, Any]:
    df = data_frame()
    if "cell_id" not in df.columns:
        return {"cell": None}

    matches = df.loc[df["cell_id"].astype("string") == str(cell_id)]
    if matches.empty:
        return {"cell": None}

    return {"cell": to_json_rows(matches.head(1))[0]}


def build_filter_mask(df: pd.DataFrame, request: QueryRequest) -> pd.Series:
    mask = pd.Series(True, index=df.index)
    for field, values in request.categorical.items():
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
