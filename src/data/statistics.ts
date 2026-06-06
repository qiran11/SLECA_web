import type { CellRecord, HistogramBin } from '../types/cell';
import { numericValue } from './filters';
import { getPatientKey, getSampleKey, uniqueCount, valueLabel } from './transformData';

export function numericSummary(cells: CellRecord[], field: string) {
  const values = cells.map((cell) => numericValue(cell[field])).filter((value): value is number => value !== null);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, mean, count: values.length };
}

export function histogram(cells: CellRecord[], field: string, bins = 12): HistogramBin[] {
  const values = cells.map((cell) => numericValue(cell[field])).filter((value): value is number => value !== null);
  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: formatNumber(min), min, max, count: values.length }];
  }

  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, index) => ({
    min: min + width * index,
    max: index === bins - 1 ? max : min + width * (index + 1),
    count: 0,
    label: `${formatNumber(min + width * index)}-${formatNumber(index === bins - 1 ? max : min + width * (index + 1))}`,
  }));

  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor((value - min) / width));
    result[index].count += 1;
  });

  return result;
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function overviewStats(cells: CellRecord[]) {
  return {
    cells: cells.length,
    samples: uniqueCount(cells, 'sample'),
    patients: new Set(cells.map(getPatientKey).filter((value) => value !== 'Unknown')).size,
    datasets: uniqueCount(cells, 'dataset'),
    cellTypes: uniqueCount(cells, 'cell_type_merge'),
    groups: groupCounts(cells),
  };
}

export function groupCounts(cells: CellRecord[]) {
  const counts = new Map<string, number>();
  cells.forEach((cell) => {
    const group = valueLabel(cell.group);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, count }));
}

export function summaryRows(cells: CellRecord[], field: 'sample' | 'patient') {
  const groups = new Map<string, CellRecord[]>();
  cells.forEach((cell) => {
    const key = field === 'sample' ? getSampleKey(cell) : getPatientKey(cell);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cell);
  });

  return Array.from(groups, ([key, records], index) => {
    const first = records[0] ?? {};
    const topCellTypes = topLocal(records, 'cell_type_merge', 3)
      .map((item) => item.label)
      .join(', ');

    if (field === 'patient') {
      return {
        id: key === 'Unknown' ? 'Unknown' : `P${String(index + 1).padStart(3, '0')}`,
        group: valueLabel(first.group),
        cell_count: records.length,
        n_samples: uniqueCount(records, 'sample'),
        n_cell_types: uniqueCount(records, 'cell_type_merge'),
        Age: valueLabel(first.Age ?? first.age),
        sex: valueLabel(first.sex),
        SLEDAI: valueLabel(first.SLEDAI),
        'SELENA-SLEDAI': valueLabel(first['SELENA-SLEDAI']),
        'Years Since Diagnosis': valueLabel(first['Years Since Diagnosis']),
        mCLASI_activity: valueLabel(first.mCLASI_activity),
        mCLASI_damage: valueLabel(first.mCLASI_damage),
      };
    }

    return {
      sample: key,
      dataset: valueLabel(first.dataset),
      group: valueLabel(first.group),
      cell_count: records.length,
      n_cell_types: uniqueCount(records, 'cell_type_merge'),
      top_cell_types: topCellTypes,
      Age: valueLabel(first.Age ?? first.age),
      sex: valueLabel(first.sex),
      SLEDAI: valueLabel(first.SLEDAI),
      mCLASI_activity: valueLabel(first.mCLASI_activity),
    };
  });
}

function topLocal(cells: CellRecord[], field: string, limit: number) {
  const counts = new Map<string, number>();
  cells.forEach((cell) => {
    const label = valueLabel(cell[field]);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
