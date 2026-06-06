import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord } from '../types/cell';
import { groupComposition, sleBucket, topValues } from '../data/transformData';
import { histogram } from '../data/statistics';
import { colorFor } from '../utils/colors';
import { BarCard } from './OverviewDashboard';
import { ChartCard } from './ChartCard';

export function ClinicalDashboard({ cells, loading }: { cells: CellRecord[]; loading: boolean }) {
  if (loading) return <div className="rounded border border-line bg-white p-8 text-center text-slate-500 shadow-soft">Loading clinical dashboard...</div>;

  const bucketed = ['0-3', '3-6', '6-9', '>=9', 'Unknown'].map((label) => ({
    label,
    count: cells.filter((cell) => sleBucket(cell.SLEDAI) === label).length,
  }));
  const groupCellTypes = groupComposition(cells, 'group');
  const sleRows = groupComposition(
    cells.map((cell) => ({ ...cell, SLEDAI_bucket: sleBucket(cell.SLEDAI) })),
    'SLEDAI_bucket',
  );
  const topTypes = topValues(cells, 'cell_type_merge', 6).map((item) => item.label);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <BarCard title="SLEDAI Distribution" data={histogram(cells, 'SLEDAI', 12)} labelKey="label" />
        <BarCard title="SELENA-SLEDAI Distribution" data={histogram(cells, 'SELENA-SLEDAI', 12)} labelKey="label" />
        <BarCard title="mCLASI Activity" data={histogram(cells, 'mCLASI_activity', 12)} labelKey="label" />
        <BarCard title="mCLASI Damage" data={histogram(cells, 'mCLASI_damage', 12)} labelKey="label" />
        <BarCard title="Years Since Diagnosis" data={histogram(cells, 'Years Since Diagnosis', 12)} labelKey="label" />
        <BarCard title="Age Distribution" data={histogram(cells, 'Age', 14)} labelKey="label" />
        <PieCard title="Sex Proportion" data={topValues(cells, 'sex', 8)} />
        <PieCard title="Group Proportion" data={topValues(cells, 'group', 8)} />
      </div>

      <CompositionCard title="Cell Type Composition by Group" data={groupCellTypes} types={topTypes} />
      <CompositionCard title="Cell Type Composition by SLEDAI Bucket" data={sleRows} types={topTypes} />
      <BarCard title="SLEDAI Buckets" data={bucketed} />
    </div>
  );
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
