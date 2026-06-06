import { X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord } from '../types/cell';
import { histogram, numericSummary, overviewStats, formatNumber } from '../data/statistics';
import { safeMetadataEntries, topValues } from '../data/transformData';
import { patientAlias } from '../utils/anonymize';
import { ChartCard } from './ChartCard';

type MetadataPanelProps = {
  selectedCell: CellRecord | null;
  cells: CellRecord[];
  aliases: Map<string, string>;
  onClearSelected: () => void;
};

export function MetadataPanel({ selectedCell, cells, aliases, onClearSelected }: MetadataPanelProps) {
  if (selectedCell) {
    const alias = patientAlias(selectedCell, aliases);
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Selected Cell</div>
            <div className="text-xs text-slate-500">{String(selectedCell.cell_id ?? 'Unknown')}</div>
          </div>
          <button className="icon-button" onClick={onClearSelected} title="Clear selected cell">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {safeMetadataEntries(selectedCell, alias).map(([key, value]) => (
            <div key={key} className="rounded border border-line bg-panel p-2">
              <div className="text-[11px] uppercase text-slate-500">{key}</div>
              <div className="break-words text-sm font-medium">{value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = overviewStats(cells);
  const qcFields = ['pct_counts_mt', 'total_counts', 'n_genes_by_counts'];

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-sm font-semibold">Filtered Summary</div>
        <div className="text-xs text-slate-500">Current selection statistics</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SmallMetric label="Cells" value={stats.cells} />
        <SmallMetric label="Samples" value={stats.samples} />
        <SmallMetric label="Patients" value={stats.patients} />
      </div>

      <MiniBars title="Cell Types Top 10" data={topValues(cells, 'cell_type_merge', 10)} />
      <MiniBars title="Group Distribution" data={topValues(cells, 'group', 8)} />
      <MiniBars title="Dataset Distribution" data={topValues(cells, 'dataset', 8)} />
      <MiniHistogram title="SLEDAI" cells={cells} field="SLEDAI" />
      <MiniHistogram title="Age" cells={cells} field="Age" />
      <MiniHistogram title="mCLASI Activity" cells={cells} field="mCLASI_activity" />

      <ChartCard title="QC Summary" dense>
        <div className="space-y-2">
          {qcFields.map((field) => {
            const summary = numericSummary(cells, field);
            return (
              <div key={field} className="rounded bg-panel p-2 text-xs">
                <span className="font-medium">{field}</span>
                <span className="ml-2 text-slate-600">
                  {summary ? `min ${formatNumber(summary.min)} / mean ${formatNumber(summary.mean)} / max ${formatNumber(summary.max)}` : 'No numeric data'}
                </span>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-panel p-2">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniBars({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  return (
    <ChartCard title={title} dense>
      <div className="h-48">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 2, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0f766e" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function MiniHistogram({ title, cells, field }: { title: string; cells: CellRecord[]; field: string }) {
  const data = histogram(cells, field, 10);
  if (!data.length) return null;
  return (
    <ChartCard title={title} dense>
      <div className="h-36">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="count" fill="#b8860b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
