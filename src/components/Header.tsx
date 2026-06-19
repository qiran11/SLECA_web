import { Download, RotateCcw } from 'lucide-react';
import type { CellRecord, DataSource } from '../types/cell';
import { downloadCells } from '../utils/download';

type HeaderProps = {
  source: DataSource;
  totalCells: number;
  filteredCells: number;
  colorBy: string;
  colorFields: string[];
  filteredRows: CellRecord[];
  aliases: Map<string, string>;
  compact?: boolean;
  onColorBy: (field: string) => void;
  onReset: () => void;
};

export function Header({
  source,
  totalCells,
  filteredCells,
  colorBy,
  colorFields,
  filteredRows,
  aliases,
  compact = false,
  onColorBy,
  onReset,
}: HeaderProps) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-ink">SLE Single-cell Atlas Browser</h1>
          <p className="text-sm text-slate-600">Interactive visualization of cell metadata, clinical annotations, and UMAP embeddings.</p>
        </div>

        {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <Metric label="File" value={source.fileName} />
          <Metric label="Loaded" value={totalCells.toLocaleString()} />
          <Metric label="Filtered" value={filteredCells.toLocaleString()} />

          <select className="control min-w-[150px]" value={colorBy} onChange={(event) => onColorBy(event.target.value)}>
            {colorFields.map((field) => (
              <option key={field} value={field}>
                Color by {field}
              </option>
            ))}
          </select>

          <button className="icon-button" onClick={onReset} title="Reset filters">
            <RotateCcw size={17} />
          </button>
          <button className="button" onClick={() => downloadCells(filteredRows, aliases)} disabled={!filteredRows.length}>
            <Download size={16} />
            Download Filtered CSV
          </button>
        </div>
        )}
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel px-3 py-1.5">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="max-w-[170px] truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
