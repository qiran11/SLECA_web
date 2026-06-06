import type { CellRecord } from '../types/cell';
import { getPatientKey } from '../data/transformData';

export function buildPatientAliases(cells: CellRecord[]) {
  const ids = Array.from(new Set(cells.map(getPatientKey).filter((value) => value !== 'Unknown'))).sort();
  return new Map(ids.map((id, index) => [id, `P${String(index + 1).padStart(3, '0')}`]));
}

export function patientAlias(cell: CellRecord, aliases: Map<string, string>): string {
  const id = getPatientKey(cell);
  return aliases.get(id) ?? 'Unknown';
}
