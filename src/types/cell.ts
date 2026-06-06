export type CellRecord = {
  [key: string]: string | number | null | undefined;
  cell_id?: string | number | null;
  UMAP_1?: number | null;
  UMAP_2?: number | null;
};

export type DataSourceKey = 'preview' | 'csvGz' | 'parquet';

export type DataSource = {
  key: DataSourceKey;
  label: string;
  fileName: string;
  path: string;
  enabled: boolean;
};

export type NumericRange = {
  min: number;
  max: number;
};

export type FilterState = {
  categorical: Record<string, Set<string>>;
  numeric: Record<string, NumericRange>;
};

export type CategoryCount = {
  label: string;
  count: number;
};

export type HistogramBin = {
  label: string;
  min: number;
  max: number;
  count: number;
};

export type SelectedCell = CellRecord | null;

export type SamplingMode = 'preview' | 'sample100k' | 'sample300k' | 'full' | 'million';

export type ClinicalBucket = '0-3' | '3-6' | '6-9' | '>=9' | 'Unknown';

export type CellQueryResponse = {
  source: string;
  total_rows: number;
  filtered_rows: number;
  returned_rows: number;
  rows: CellRecord[];
};

export type CellMetadataResponse = {
  cell: CellRecord | null;
};

export type DenseUmapChunkResponse = {
  source: string;
  total_rows: number;
  filtered_rows: number;
  returned_rows: number;
  offset: number;
  x: number[];
  y: number[];
  cell_id: Array<string | number | null>;
  color?: Array<string | number | null>;
};

export type DenseUmapData = {
  positions: Float32Array;
  colors: Float32Array;
  cellIds: Array<string | number | null>;
  loaded: number;
  target: number;
  totalFiltered: number;
};

export type FilterSummary = {
  total_rows: number;
  filtered_rows: number;
  categorical: Record<string, CategoryCount[]>;
  numeric: Record<
    string,
    {
      min: number;
      max: number;
      mean: number;
      bins: HistogramBin[];
    }
  >;
};
