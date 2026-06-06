import type { ReactNode } from 'react';

export function ChartCard({ title, children, dense = false }: { title: string; children: ReactNode; dense?: boolean }) {
  return (
    <section className={`rounded border border-line bg-white shadow-soft ${dense ? 'p-3' : 'p-4'}`}>
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
