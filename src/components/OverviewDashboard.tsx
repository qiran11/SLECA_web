import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CellRecord } from '../types/cell';
import { histogram, overviewStats } from '../data/statistics';
import { topValues } from '../data/transformData';
import { colorFor } from '../utils/colors';
import { ChartCard } from './ChartCard';

export function OverviewDashboard({ cells, loading }: { cells: CellRecord[]; loading: boolean }) {
  const stats = overviewStats(cells);
  if (loading) return <DashboardNote>Loading overview...</DashboardNote>;

  return (
    <div className="space-y-4">
      <MetricGrid
        metrics={[
          ['Cells', stats.cells],
          ['Samples', stats.samples],
          ['Patients', stats.patients],
          ['Datasets', stats.datasets],
          ['Cell Types', stats.cellTypes],
        ]}
      />

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <BarCard title="Top 10 Cell Types" data={topValues(cells, 'cell_type_merge', 10)} />
        <BarCard title="Top Datasets" data={topValues(cells, 'dataset', 10)} />
        <PieCard title="SLE / HC Cells" data={topValues(cells, 'group', 8)} />
        <BarCard title="Age Distribution" data={histogram(cells, 'Age', 14)} labelKey="label" />
        <BarCard title="SLEDAI Distribution" data={histogram(cells, 'SLEDAI', 12)} labelKey="label" />
        <BarCard title="mCLASI Activity" data={histogram(cells, 'mCLASI_activity', 12)} labelKey="label" />
        <BarCard title="pct_counts_mt QC" data={histogram(cells, 'pct_counts_mt', 14)} labelKey="label" />
        <BarCard title="total_counts QC" data={histogram(cells, 'total_counts', 14)} labelKey="label" />
      </div>
    </div>
  );
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
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  labelKey?: string;
}) {
  return (
    <ChartCard title={title}>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 8, right: 12, top: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#0f766e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
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
