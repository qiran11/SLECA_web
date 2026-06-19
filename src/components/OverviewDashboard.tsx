import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord, FilterSummary } from '../types/cell';
import { histogram, overviewStats } from '../data/statistics';
import { topValues, uniqueCount, valueLabel } from '../data/transformData';
import { colorFor } from '../utils/colors';
import { ChartCard } from './ChartCard';

type SummaryRow = Record<string, string | number>;

export function OverviewDashboard({
  cells,
  loading,
  summary,
  sampleRows,
}: {
  cells: CellRecord[];
  loading: boolean;
  summary?: FilterSummary | null;
  sampleRows?: SummaryRow[] | null;
}) {
  const peopleRows = sampleRows ?? cells;
  const stats = summary
    ? {
        cells: summary.filtered_rows,
        samples: sampleRows?.length ?? summary.unique.Sample ?? 0,
        origins: uniqueCount(peopleRows, 'origin'),
        datasets: uniqueCount(peopleRows, 'dataset'),
        cellTypes: summary.categorical['Cell subtype']?.filter(isKnownLabel).length ?? 0,
      }
    : { ...overviewStats(cells), origins: uniqueCount(peopleRows, 'Origin') };
  const topCellSubtypes = summary
    ? (summary.categorical['Cell subtype'] ?? []).filter(isKnownLabel).slice(0, 10)
    : knownTopValues(cells, 'Cell subtype', 10);
  const majorCellTypes = summary
    ? (summary.categorical['Major cell type'] ?? []).filter(isKnownLabel).slice(0, 10)
    : knownTopValues(cells, 'Major cell type', 10);
  if (loading) return <DashboardNote>Loading overview...</DashboardNote>;

  return (
    <div className="space-y-4">
      <MetricGrid
        metrics={[
          ['Cells', stats.cells],
          ['People', stats.samples],
          ['Origins', stats.origins],
          ['Datasets', stats.datasets],
          ['Cell Types', stats.cellTypes],
        ]}
      />

      <div className="grid grid-cols-3 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
        <BarCard title="Top 10 Cell Subtypes" data={topCellSubtypes} />
        <BarCard title="Major Cell Types" data={majorCellTypes} />
        <CohortTable rows={peopleRows} />
        <PieCard title="Groups by People" data={topValuesAny(peopleRows, 'group', 'Group', 8)} />
        <BarCard title="Age Distribution by People" data={histogramAny(peopleRows, 'Age', 14)} labelKey="label" variant="numeric" />
        <BarCard title="SLEDAI Distribution by People" data={histogramAny(peopleRows, 'SLEDAI', 12)} labelKey="label" variant="numeric" />
        <BarCard title="Age Group by People" data={topValuesAny(peopleRows, 'Age group', 'Age group', 10)} />
        <BarCard title="Origin by People" data={topValuesAny(peopleRows, 'origin', 'Origin', 10)} />
        <BarCard title="Datasets by People" data={topValuesAny(peopleRows, 'dataset', 'Dataset', 10)} />
      </div>
    </div>
  );
}

function isKnownLabel(item: { label: string }) {
  return item.label.toLowerCase() !== 'unknown';
}

function knownTopValues(cells: CellRecord[], field: string, limit: number) {
  return topValues(cells, field, 1000).filter(isKnownLabel).slice(0, limit);
}

export function MetricGrid({ metrics }: { metrics: Array<[string, number]> }) {
  return (
    <div className="grid grid-cols-5 gap-3 max-xl:grid-cols-3 max-md:grid-cols-2">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded border border-line bg-white p-4 shadow-soft">
          <div className="text-xs uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

export function BarCard({
  title,
  data,
  labelKey = 'label',
  variant = 'categorical',
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  labelKey?: string;
  variant?: 'categorical' | 'numeric';
}) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 8, right: 12, top: 10, bottom: variant === 'categorical' ? 54 : 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={labelKey}
              tick={{ fontSize: 11 }}
              interval={variant === 'categorical' ? 0 : 'preserveStartEnd'}
              angle={variant === 'categorical' ? -28 : 0}
              textAnchor={variant === 'categorical' ? 'end' : 'middle'}
              height={variant === 'categorical' ? 58 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`${String(entry[labelKey])}-${index}`}
                  fill={variant === 'numeric' ? numericColor(index, data.length) : colorFor(String(entry[labelKey] ?? entry.label ?? index))}
                />
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

function PieCard({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={58} outerRadius={98} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={colorFor(entry.label)} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function DashboardNote({ children }: { children: string }) {
  return <div className="rounded border border-line bg-white p-8 text-center text-slate-500 shadow-soft">{children}</div>;
}

function CohortTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const visible = [...rows]
    .sort((a, b) => Number(b.cell_count ?? 0) - Number(a.cell_count ?? 0))
    .slice(0, 8);

  return (
    <ChartCard title="People Summary">
      <div className="h-72 overflow-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-slate-500">
              {['Sample', 'Group', 'Sex', 'Age', 'SLEDAI', 'Cells'].map((header) => (
                <th key={header} className="border-b border-line px-2 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={`${valueLabel(row.sample ?? row.Sample)}-${index}`} className="odd:bg-panel/60">
                <td className="border-b border-line px-2 py-2 font-medium">{valueLabel(row.sample ?? row.Sample)}</td>
                <td className="border-b border-line px-2 py-2">{valueLabel(row.group ?? row.Group)}</td>
                <td className="border-b border-line px-2 py-2">{valueLabel(row.Sex)}</td>
                <td className="border-b border-line px-2 py-2">{valueLabel(row.Age)}</td>
                <td className="border-b border-line px-2 py-2">{valueLabel(row.SLEDAI)}</td>
                <td className="border-b border-line px-2 py-2 text-right">{Number(row.cell_count ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function topValuesAny(rows: Array<Record<string, unknown>>, field: string, fallbackField: string, limit: number) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = valueLabel(row[field] ?? row[fallbackField]);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function histogramAny(rows: Array<Record<string, unknown>>, field: string, bins: number) {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: String(min), min, max, count: values.length }];
  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, index) => ({
    min: min + width * index,
    max: index === bins - 1 ? max : min + width * (index + 1),
    count: 0,
    label: `${formatAxis(min + width * index)}-${formatAxis(index === bins - 1 ? max : min + width * (index + 1))}`,
  }));
  values.forEach((value) => {
    result[Math.min(bins - 1, Math.floor((value - min) / width))].count += 1;
  });
  return result;
}

function formatAxis(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
