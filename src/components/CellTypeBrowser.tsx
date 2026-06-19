import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import type { CategoryCount, CellRecord } from '../types/cell';
import { histogram } from '../data/statistics';
import { topValues, valueLabel } from '../data/transformData';
import { BarCard, MetricGrid } from './OverviewDashboard';

type CellTypeBrowserProps = {
  cells: CellRecord[];
  colorBy: string;
  cellTypeCounts?: CategoryCount[] | null;
  onColorBy: (field: string) => void;
  onHighlight: (cellType: string) => void;
  onBackToUmap: () => void;
};

export function CellTypeBrowser({ cells, cellTypeCounts, onColorBy, onHighlight, onBackToUmap }: CellTypeBrowserProps) {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const counts = useMemo(
    () => (cellTypeCounts ?? topValues(cells, 'Cell subtype', 500)).filter((item) => item.label.toLowerCase() !== 'unknown'),
    [cellTypeCounts, cells],
  );
  const visible = counts.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const selectedRows = cells.filter((cell) => valueLabel(cell['Cell subtype']) === selectedType);
  const selectedCount = selectedType ? counts.find((item) => item.label === selectedType)?.count ?? selectedRows.length : 0;

  return (
    <div className="grid grid-cols-[360px_1fr] gap-4 max-lg:grid-cols-1">
      <section className="rounded border border-line bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Search size={16} />
          <input className="input w-full" placeholder="Search cell types" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="max-h-[70vh] space-y-1 overflow-auto pr-1">
          {visible.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                selectedType === item.label ? 'bg-teal text-white' : 'hover:bg-panel'
              }`}
              onClick={() => setSelectedType(item.label)}
            >
              <span className="truncate">{item.label}</span>
              <span className="text-xs opacity-80">{item.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {!selectedType ? (
          <BarCard title="All Cell Types" data={counts.slice(0, 20)} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-white p-4 shadow-soft">
              <div>
                <h2 className="text-lg font-semibold">{selectedType}</h2>
                <p className="text-sm text-slate-500">Cell type detail and distribution</p>
              </div>
              <button
                className="button"
                onClick={() => {
                  onColorBy('Cell subtype');
                  onHighlight(selectedType);
                  onBackToUmap();
                }}
              >
                <ArrowLeft size={16} />
                Highlight in UMAP
              </button>
            </div>

            <MetricGrid
              metrics={[
                ['Cells', selectedCount],
                ['Datasets', new Set(selectedRows.map((row) => valueLabel(row.Dataset))).size],
                ['Samples', new Set(selectedRows.map((row) => valueLabel(row.Sample))).size],
                ['Groups', new Set(selectedRows.map((row) => valueLabel(row.Group))).size],
                ['Origins', new Set(selectedRows.map((row) => valueLabel(row.Origin))).size],
              ]}
            />

            <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <BarCard title="Groups" data={topValues(selectedRows, 'Group', 8)} />
              <BarCard title="Datasets" data={topValues(selectedRows, 'Dataset', 10)} />
              <BarCard title="Samples" data={topValues(selectedRows, 'Sample', 10)} />
              <BarCard title="SLEDAI Distribution" data={histogram(selectedRows, 'SLEDAI', 10)} labelKey="label" variant="numeric" />
              <BarCard title="Age Distribution" data={histogram(selectedRows, 'Age', 10)} labelKey="label" variant="numeric" />
              <BarCard title="Major Cell Types" data={topValues(selectedRows, 'Major cell type', 10)} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
