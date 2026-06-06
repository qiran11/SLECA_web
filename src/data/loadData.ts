import Papa from 'papaparse';
import { inflate } from 'pako';
import type { CellMetadataResponse, CellQueryResponse, CellRecord, DataSource, DataSourceKey, DenseUmapChunkResponse, FilterState } from '../types/cell';

const MAX_BROWSER_CSV_GZ_ROWS = 100000;

export const DATA_SOURCES: DataSource[] = [
  {
    key: 'preview',
    label: 'Preview CSV',
    fileName: 'cell_metadata_umap_preview.csv',
    path: '/cell_metadata_umap_preview.csv',
    enabled: true,
  },
  {
    key: 'csvGz',
    label: 'Compressed CSV',
    fileName: 'cell_metadata_umap.csv.gz',
    path: '/cell_metadata_umap.csv.gz',
    enabled: true,
  },
  {
    key: 'parquet',
    label: 'Parquet API',
    fileName: 'cell_metadata_umap.parquet',
    path: 'http://127.0.0.1:8000/api/cells/query',
    enabled: true,
  },
];

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';

const NUMERIC_HINTS = new Set([
  'UMAP_1',
  'UMAP_2',
  'Age',
  'age',
  'SLEDAI',
  'SELENA-SLEDAI',
  'Years Since Diagnosis',
  'mCLASI_activity',
  'mCLASI_damage',
  'n_genes_by_counts',
  'total_counts',
  'pct_counts_mt',
  'doublet_scores',
]);

export function getDataSource(key: DataSourceKey): DataSource {
  return DATA_SOURCES.find((source) => source.key === key) ?? DATA_SOURCES[0];
}

export async function loadCells(sourceKey: DataSourceKey): Promise<CellRecord[]> {
  const source = getDataSource(sourceKey);

  if (source.key === 'parquet') {
    return queryParquetCells({ categorical: {}, numeric: {} }, 100000).then((response) => response.rows);
  }

  const response = await fetch(source.path);
  if (!response.ok) {
    throw new Error(`Could not load ${source.fileName}`);
  }

  const text = source.key === 'csvGz' ? sampleCsvText(await readMaybeCompressedCsv(response), MAX_BROWSER_CSV_GZ_ROWS) : await response.text();

  return parseCsv(text);
}

export async function queryParquetCells(filters: FilterState, limit: number): Promise<CellQueryResponse> {
  return queryParquetCellsPage(filters, limit, 0);
}

export async function queryParquetCellsPage(
  filters: FilterState,
  limit: number,
  offset: number,
  columns?: string[],
): Promise<CellQueryResponse> {
  const response = await fetch(`${API_BASE}/api/cells/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categorical: Object.fromEntries(
        Object.entries(filters.categorical)
          .filter(([, values]) => values.size > 0)
          .map(([field, values]) => [field, Array.from(values)]),
      ),
      numeric: filters.numeric,
      limit,
      offset,
      columns,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not query parquet API (${response.status})`);
  }

  return response.json();
}

export async function loadCellMetadata(cellId: string | number): Promise<CellRecord | null> {
  const response = await fetch(`${API_BASE}/api/cells/${encodeURIComponent(String(cellId))}`);
  if (!response.ok) {
    throw new Error(`Could not load cell metadata (${response.status})`);
  }
  const payload = (await response.json()) as CellMetadataResponse;
  return payload.cell;
}

export async function queryDenseUmapChunk(filters: FilterState, limit: number, offset: number): Promise<DenseUmapChunkResponse> {
  const response = await fetch(`${API_BASE}/api/umap/dense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categorical: Object.fromEntries(
        Object.entries(filters.categorical)
          .filter(([, values]) => values.size > 0)
          .map(([field, values]) => [field, Array.from(values)]),
      ),
      numeric: filters.numeric,
      limit,
      offset,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not query dense UMAP API (${response.status})`);
  }

  return response.json();
}

function sampleCsvText(csvText: string, maxRows: number): string {
  const lines = csvText.split(/\r?\n/);
  if (lines.length <= maxRows + 1) return csvText;
  return [lines[0], ...lines.slice(1, maxRows + 1)].join('\n');
}

async function readMaybeCompressedCsv(response: Response): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (isGzip) return inflate(bytes, { to: 'string' });
  return new TextDecoder().decode(bytes);
}

function parseCsv(csvText: string): Promise<CellRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (result) => resolve(result.data.map(normalizeRow)),
      error: (error: Error) => reject(error),
    });
  });
}

function normalizeRow(row: Record<string, string>): CellRecord {
  const normalized: CellRecord = {};

  Object.entries(row).forEach(([key, rawValue]) => {
    const value = normalizeMissing(rawValue);
    if (value === null) {
      normalized[key] = null;
      return;
    }

    if (NUMERIC_HINTS.has(key)) {
      const numberValue = Number(value);
      normalized[key] = Number.isFinite(numberValue) ? numberValue : value;
      return;
    }

    normalized[key] = value;
  });

  return normalized;
}

export function normalizeMissing(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || ['nan', 'na', 'n/a', 'null', 'none', 'undefined', ''].includes(text.toLowerCase())) {
    return null;
  }
  return text;
}
