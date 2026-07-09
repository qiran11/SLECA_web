import { X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord, FilterSummary } from '../types/cell';
import { histogram, overviewStats } from '../data/statistics';
import { safeMetadataEntries, topValues } from '../data/transformData';
import { patientAlias } from '../utils/anonymize';
import { colorFor } from '../utils/colors';
import { ChartCard } from './ChartCard';

type MetadataPanelProps = {
  selectedCell: CellRecord | null;
  cells: CellRecord[];
  aliases: Map<string, string>;
  summary?: FilterSummary | null;
  onClearSelected: () => void;
};

export function MetadataPanel({ selectedCell, cells, aliases, summary, onClearSelected }: MetadataPanelProps) {
  if (selectedCell) {
    const alias = patientAlias(selectedCell, aliases);
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Selected Cell</div>
            <div className="text-xs text-slate-500">{String(selectedCell['Cell ID'] ?? selectedCell.cell_id ?? 'Unknown')}</div>
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

  const stats = summary
    ? {
        cells: summary.filtered_rows,
        samples: summary.unique.Sample ?? 0,
        patients: summary.unique.Origin ?? 0,
      }
    : overviewStats(cells);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-sm font-semibold">Filtered Summary</div>
        <div className="text-xs text-slate-500">Current selection statistics</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SmallMetric label="Cells" value={stats.cells} />
        <SmallMetric label="Samples" value={stats.samples} />
        <SmallMetric label="Origins" value={stats.patients} />
      </div>

      <MiniBars title="Cell Subtypes Top 10" data={(summary?.categorical['Cell subtype'] ?? topValues(cells, 'Cell subtype', 10)).slice(0, 10)} />
      <MiniBars title="Major Cell Types" data={(summary?.categorical['Major cell type'] ?? topValues(cells, 'Major cell type', 8)).slice(0, 8)} />
      <MiniBars title="Group Distribution" data={(summary?.categorical.Group ?? topValues(cells, 'Group', 8)).slice(0, 8)} />
      <MiniBars title="Dataset Distribution" data={(summary?.categorical.Dataset ?? topValues(cells, 'Dataset', 8)).slice(0, 8)} />
      <MiniHistogram title="SLEDAI" cells={cells} field="SLEDAI" bins={summary?.numeric.SLEDAI?.bins} />
      <MiniHistogram title="Age" cells={cells} field="Age" bins={summary?.numeric.Age?.bins} />
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
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={colorFor(entry.label)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function MiniHistogram({
  title,
  cells,
  field,
  bins,
}: {
  title: string;
  cells: CellRecord[];
  field: string;
  bins?: Array<{ label: string; min: number; max: number; count: number }>;
}) {
  const data = bins ?? histogram(cells, field, 10);
  if (!data.length) return null;
  return (
    <ChartCard title={title} dense>
      <div className="h-36">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={numericColor(index, data.length)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function numericColor(index: number, total: number) {
  const colors = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];
  const bucket = Math.min(colors.length - 1, Math.floor((index / Math.max(total - 1, 1)) * colors.length));
  return colors[bucket];
}
