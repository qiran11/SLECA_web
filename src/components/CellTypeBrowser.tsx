import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord } from '../types/cell';
import { histogram } from '../data/statistics';
import { topValues, valueLabel } from '../data/transformData';
import { ChartCard } from './ChartCard';
import { BarCard, MetricGrid } from './OverviewDashboard';

type CellTypeBrowserProps = {
  cells: CellRecord[];
  colorBy: string;
  onColorBy: (field: string) => void;
  onHighlight: (cellType: string) => void;
  onBackToUmap: () => void;
};

export function CellTypeBrowser({ cells, onColorBy, onHighlight, onBackToUmap }: CellTypeBrowserProps) {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const counts = useMemo(() => topValues(cells, 'cell_type_merge', 500), [cells]);
  const visible = counts.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const selectedRows = cells.filter((cell) => valueLabel(cell.cell_type_merge) === selectedType);

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
                  onColorBy('cell_type_merge');
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
                ['Cells', selectedRows.length],
                ['Datasets', new Set(selectedRows.map((row) => valueLabel(row.dataset))).size],
                ['Samples', new Set(selectedRows.map((row) => valueLabel(row.sample))).size],
                ['Groups', new Set(selectedRows.map((row) => valueLabel(row.group))).size],
                ['Patients', new Set(selectedRows.map((row) => valueLabel(row.Patient_ID))).size],
              ]}
            />

            <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <BarCard title="SLE / HC Counts" data={topValues(selectedRows, 'group', 8)} />
              <BarCard title="Datasets" data={topValues(selectedRows, 'dataset', 10)} />
              <BarCard title="Samples" data={topValues(selectedRows, 'sample', 10)} />
              <BarCard title="SLEDAI Distribution" data={histogram(selectedRows, 'SLEDAI', 10)} labelKey="label" />
              <BarCard title="Age Distribution" data={histogram(selectedRows, 'Age', 10)} labelKey="label" />
              <QcChart rows={selectedRows} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function QcChart({ rows }: { rows: CellRecord[] }) {
  const data = ['pct_counts_mt', 'total_counts', 'n_genes_by_counts'].map((field) => ({
    label: field,
    count:
      rows
        .map((row) => Number(row[field]))
        .filter(Number.isFinite)
        .reduce((sum, value, _, arr) => sum + value / Math.max(arr.length, 1), 0) || 0,
  }));

  return (
    <ChartCard title="QC Mean Values">
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#d75a4a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
