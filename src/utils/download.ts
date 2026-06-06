import type { CellRecord } from '../types/cell';
import { patientAlias } from './anonymize';

export function downloadCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))].join('\n');
  downloadBlob(csv, filename, 'text/csv;charset=utf-8');
}

export function downloadCells(cells: CellRecord[], aliases?: Map<string, string>, filename = 'filtered_cells.csv') {
  const rows = cells.map((cell) => {
    const safeCell = { ...cell };
    delete safeCell.source_path;
    if (aliases) {
      const alias = patientAlias(cell, aliases);
      if ('Patient_ID' in safeCell) safeCell.Patient_ID = alias;
      if ('Participant' in safeCell) safeCell.Participant = alias;
    }
    return safeCell;
  });
  downloadCsv(rows, filename);
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
