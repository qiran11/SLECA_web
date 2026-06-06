import { Download, RotateCcw } from 'lucide-react';
import type { CellRecord, DataSource, DataSourceKey, SamplingMode } from '../types/cell';
import { downloadCells } from '../utils/download';

type HeaderProps = {
  source: DataSource;
  sources: DataSource[];
  totalCells: number;
  filteredCells: number;
  colorBy: string;
  colorFields: string[];
  samplingMode: SamplingMode;
  filteredRows: CellRecord[];
  aliases: Map<string, string>;
  onColorBy: (field: string) => void;
  onReset: () => void;
  onSource: (source: DataSourceKey) => void;
  onSamplingMode: (mode: SamplingMode) => void;
};

export function Header({
  source,
  sources,
  totalCells,
  filteredCells,
  colorBy,
  colorFields,
  samplingMode,
  filteredRows,
  aliases,
  onColorBy,
  onReset,
  onSource,
  onSamplingMode,
}: HeaderProps) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-ink">SLE Single-cell Atlas Browser</h1>
          <p className="text-sm text-slate-600">Interactive visualization of cell metadata, clinical annotations, and UMAP embeddings.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Metric label="File" value={source.fileName} />
          <Metric label="Loaded" value={totalCells.toLocaleString()} />
          <Metric label="Filtered" value={filteredCells.toLocaleString()} />

          <select className="control min-w-[150px]" value={source.key} onChange={(event) => onSource(event.target.value as DataSourceKey)}>
            {sources.map((item) => (
              <option key={item.key} value={item.key} disabled={!item.enabled}>
                {item.label}
              </option>
            ))}
          </select>

          <select className="control min-w-[150px]" value={colorBy} onChange={(event) => onColorBy(event.target.value)}>
            {colorFields.map((field) => (
              <option key={field} value={field}>
                Color by {field}
              </option>
            ))}
          </select>

          <select className="control min-w-[150px]" value={samplingMode} onChange={(event) => onSamplingMode(event.target.value as SamplingMode)}>
            <option value="preview">Preview mode</option>
            <option value="sample100k">Sample 100k cells</option>
            <option value="sample300k">Sample 300k cells</option>
            <option value="full">Max 300k render</option>
            <option value="million">All cells batched</option>
          </select>

          <button className="icon-button" onClick={onReset} title="Reset filters">
            <RotateCcw size={17} />
          </button>
          <button className="button" onClick={() => downloadCells(filteredRows, aliases)} disabled={!filteredRows.length}>
            <Download size={16} />
            Download Filtered CSV
          </button>
        </div>
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
