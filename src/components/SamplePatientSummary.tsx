import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { CellRecord } from '../types/cell';
import { summaryRows } from '../data/statistics';
import { downloadCsv } from '../utils/download';

type TableMode = 'sample' | 'patient';

export function SamplePatientSummary({
  cells,
  serverRows,
  onMode,
}: {
  cells: CellRecord[];
  serverRows?: Array<Record<string, string | number>> | null;
  onMode?: (mode: TableMode) => void;
}) {
  const [mode, setMode] = useState<TableMode>('sample');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('cell_count');
  const [sortAsc, setSortAsc] = useState(false);
  const rows = useMemo(() => summaryRows(cells, mode), [cells, mode]);
  const tableRows = serverRows ?? (rows as unknown as Array<Record<string, string | number>>);
  const visibleRows = useMemo(() => {
    return tableRows
      .filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => compareValues(a[sortKey], b[sortKey], sortAsc));
  }, [query, tableRows, sortAsc, sortKey]);
  const headers = Object.keys(tableRows[0] ?? {});

  return (
    <section className="rounded border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold">Sample / Patient Summary</h2>
          <p className="text-sm text-slate-500">{visibleRows.length.toLocaleString()} summary rows</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded border border-line p-0.5">
            {(['sample', 'patient'] as TableMode[]).map((item) => (
              <button
                key={item}
                className={`rounded px-3 py-1.5 text-sm capitalize ${mode === item ? 'bg-teal text-white' : 'text-slate-600 hover:bg-panel'}`}
                onClick={() => {
                  setMode(item);
                  onMode?.(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded border border-line px-2">
            <Search size={15} className="text-slate-500" />
            <input className="h-8 outline-none" placeholder="Search rows" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="button" onClick={() => downloadCsv(visibleRows, `${mode}_summary.csv`)}>
            <Download size={16} />
            Download CSV
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {headers.map((header) => (
                <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                  <button
                    className="whitespace-nowrap"
                    onClick={() => {
                      setSortAsc(sortKey === header ? !sortAsc : false);
                      setSortKey(header);
                    }}
                  >
                    {header}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={index} className="odd:bg-white even:bg-panel/70">
                {headers.map((header) => (
                  <td key={header} className="border-b border-line px-3 py-2">
                    {String(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function compareValues(a: unknown, b: unknown, asc: boolean) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  const result =
    Number.isFinite(aNumber) && Number.isFinite(bNumber)
      ? aNumber - bNumber
      : String(a).localeCompare(String(b), undefined, { numeric: true });
  return asc ? result : -result;
}
