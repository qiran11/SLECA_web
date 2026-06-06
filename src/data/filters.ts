import type { CellRecord, FilterState, NumericRange, SamplingMode } from '../types/cell';
import { valueLabel } from './transformData';

export const CATEGORICAL_FIELDS = [
  'group',
  'dataset',
  'batch',
  'sample',
  'sex',
  'Status',
  'cell_type_merge',
  'cell_type_major_n',
  'cell_type_clean',
  'clusters',
  'louvain',
];

export const NUMERIC_FIELDS = [
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
];

export const COLOR_FIELDS = [
  'cell_type_merge',
  'cell_type_major_n',
  'group',
  'dataset',
  'sample',
  'sex',
  'SLEDAI',
  'Age',
  'pct_counts_mt',
  'total_counts',
  'n_genes_by_counts',
  'doublet_scores',
];

export const emptyFilters = (): FilterState => ({ categorical: {}, numeric: {} });

export function applyFilters(cells: CellRecord[], filters: FilterState): CellRecord[] {
  const categoricalEntries = Object.entries(filters.categorical).filter(([, values]) => values.size > 0);
  const numericEntries = Object.entries(filters.numeric);

  if (categoricalEntries.length === 0 && numericEntries.length === 0) {
    return cells;
  }

  return cells.filter((cell) => {
    for (const [field, selected] of categoricalEntries) {
      if (!selected.has(valueLabel(cell[field]))) return false;
    }

    for (const [field, range] of numericEntries) {
      const value = numericValue(cell[field]);
      if (value === null || value < range.min || value > range.max) return false;
    }

    return true;
  });
}

export function toggleCategory(filters: FilterState, field: string, value: string): FilterState {
  const next = cloneFilters(filters);
  const set = next.categorical[field] ?? new Set<string>();
  set.has(value) ? set.delete(value) : set.add(value);
  next.categorical[field] = set;
  return next;
}

export function clearField(filters: FilterState, field: string): FilterState {
  const next = cloneFilters(filters);
  delete next.categorical[field];
  delete next.numeric[field];
  return next;
}

export function setNumericRange(filters: FilterState, field: string, range: NumericRange): FilterState {
  const next = cloneFilters(filters);
  next.numeric[field] = range;
  return next;
}

export function cloneFilters(filters: FilterState): FilterState {
  return {
    categorical: Object.fromEntries(
      Object.entries(filters.categorical).map(([field, values]) => [field, new Set(values)]),
    ),
    numeric: { ...filters.numeric },
  };
}

export function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function sampleCells(cells: CellRecord[], mode: SamplingMode): CellRecord[] {
  const limit = mode === 'sample100k' ? 100000 : mode === 'sample300k' ? 300000 : cells.length;
  if (mode === 'full' || mode === 'preview' || cells.length <= limit) return cells;

  const stride = Math.max(1, Math.floor(cells.length / limit));
  const sampled: CellRecord[] = [];
  for (let index = 0; index < cells.length && sampled.length < limit; index += stride) {
    sampled.push(cells[index]);
  }
  return sampled;
}
