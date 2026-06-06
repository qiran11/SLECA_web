import type { CellRecord, ClinicalBucket } from '../types/cell';

const privateFields = new Set(['source_path', 'Race', 'Ethnicity', 'location of skin lesions']);

export function availableFields(cells: CellRecord[], candidates: string[]): string[] {
  const first = cells[0] ?? {};
  return candidates.filter((field) => Object.prototype.hasOwnProperty.call(first, field));
}

export function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return String(value);
}

export function uniqueCount(cells: CellRecord[], field: string): number {
  return new Set(cells.map((cell) => valueLabel(cell[field])).filter((value) => value !== 'Unknown')).size;
}

export function topValues(cells: CellRecord[], field: string, limit = 10) {
  const counts = new Map<string, number>();
  cells.forEach((cell) => {
    const label = valueLabel(cell[field]);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function safeMetadataEntries(cell: CellRecord, patientAlias: string): Array<[string, string]> {
  return Object.entries(cell)
    .filter(([key]) => !privateFields.has(key))
    .map(([key, value]) => [key, key === 'Patient_ID' || key === 'Participant' ? patientAlias : valueLabel(value)]);
}

export function getPatientKey(cell: CellRecord): string {
  return valueLabel(cell.Patient_ID ?? cell.Participant ?? cell.patient_id);
}

export function getSampleKey(cell: CellRecord): string {
  return valueLabel(cell.sample ?? cell.sample_name);
}

export function getCellType(cell: CellRecord): string {
  return valueLabel(cell.cell_type_merge ?? cell.cell_type_major_n ?? cell.cell_type_clean);
}

export function sleBucket(value: unknown): ClinicalBucket {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) return 'Unknown';
  if (score < 3) return '0-3';
  if (score < 6) return '3-6';
  if (score < 9) return '6-9';
  return '>=9';
}

export function groupComposition(cells: CellRecord[], groupField: string, typeField = 'cell_type_merge') {
  const groups = new Map<string, Map<string, number>>();

  cells.forEach((cell) => {
    const group = valueLabel(cell[groupField]);
    const type = valueLabel(cell[typeField]);
    if (!groups.has(group)) groups.set(group, new Map());
    const typeCounts = groups.get(group)!;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  });

  const topTypes = topValues(cells, typeField, 8).map((item) => item.label);
  return Array.from(groups, ([group, counts]) => {
    const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    const row: Record<string, string | number> = { group, total };
    topTypes.forEach((type) => {
      row[type] = counts.get(type) ?? 0;
      row[`${type} %`] = total ? Math.round(((counts.get(type) ?? 0) / total) * 1000) / 10 : 0;
    });
    return row;
  });
}
