import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord } from '../types/cell';
import { groupComposition, sleBucket, topValues, valueLabel } from '../data/transformData';
import { colorFor } from '../utils/colors';
import { BarCard } from './OverviewDashboard';
import { ChartCard } from './ChartCard';

type SummaryRow = Record<string, string | number>;

export function ClinicalDashboard({
  cells,
  loading,
  sampleRows,
}: {
  cells: CellRecord[];
  loading: boolean;
  sampleRows?: SummaryRow[] | null;
}) {
  if (loading) return <div className="rounded border border-line bg-white p-8 text-center text-slate-500 shadow-soft">Loading clinical dashboard...</div>;

  const peopleRows = sampleRows ?? cells;
  const bucketed = ['0-3', '3-6', '6-9', '>=9', 'Unknown'].map((label) => ({
    label,
    count: peopleRows.filter((row) => sleBucket(row.SLEDAI) === label).length,
  }));
  const groupCellTypes = groupComposition(cells, 'Group');
  const sleRows = groupComposition(
    cells.map((cell) => ({ ...cell, SLEDAI_bucket: sleBucket(cell.SLEDAI) })),
    'SLEDAI_bucket',
  );
  const topTypes = topValues(cells, 'Cell subtype', 6).map((item) => item.label);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <BarCard title="SLEDAI Distribution by People" data={histogramAny(peopleRows, 'SLEDAI', 12)} labelKey="label" variant="numeric" />
        <BarCard title="Age Distribution by People" data={histogramAny(peopleRows, 'Age', 14)} labelKey="label" variant="numeric" />
        <PieCard title="Sex Proportion by People" data={topValuesAny(peopleRows, 'Sex', 8)} />
        <PieCard title="Group Proportion by People" data={topValuesAny(peopleRows, 'group', 8, 'Group')} />
        <div className="col-span-2 max-lg:col-span-1">
          <BarCard title="Age Group by People" data={topValuesAny(peopleRows, 'Age group', 10)} />
        </div>
      </div>

      <CompositionCard title="Cell Subtype Composition by Group" data={groupCellTypes} types={topTypes} />
      <CompositionCard title="Cell Subtype Composition by SLEDAI Bucket" data={sleRows} types={topTypes} />
      <BarCard title="SLEDAI Buckets" data={bucketed} />
    </div>
  );
}

function topValuesAny(rows: Array<Record<string, unknown>>, field: string, limit: number, fallbackField?: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = valueLabel(row[field] ?? (fallbackField ? row[fallbackField] : undefined));
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

function PieCard({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={58} outerRadius={98}>
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

function CompositionCard({ title, data, types }: { title: string; data: Array<Record<string, string | number>>; types: string[] }) {
  return (
    <ChartCard title={title}>
      <div className="h-96">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 10, right: 16, top: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="group" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {types.map((type) => (
              <Bar key={type} dataKey={type} stackId="cellTypes" fill={colorFor(type)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
