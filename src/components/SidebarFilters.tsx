import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { CellRecord, FilterState } from '../types/cell';
import { CATEGORICAL_FIELDS, NUMERIC_FIELDS, clearField, setNumericRange, toggleCategory } from '../data/filters';
import { histogram, numericSummary, formatNumber } from '../data/statistics';
import { availableFields, topValues, valueLabel } from '../data/transformData';

type SidebarFiltersProps = {
  cells: CellRecord[];
  filteredCells: CellRecord[];
  filters: FilterState;
  onFilters: (filters: FilterState) => void;
};

export function SidebarFilters({ cells, filteredCells, filters, onFilters }: SidebarFiltersProps) {
  const categoricalFields = useMemo(() => availableFields(cells, CATEGORICAL_FIELDS), [cells]);
  const numericFields = useMemo(() => availableFields(cells, NUMERIC_FIELDS), [cells]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold">Metadata Filters</div>
        <div className="mt-1 text-xs text-slate-500">{filteredCells.length.toLocaleString()} cells after filters</div>
      </div>

      <div className="space-y-3">
        {categoricalFields.map((field) => (
          <CategoricalFilter
            key={field}
            field={field}
            cells={cells}
            selected={filters.categorical[field] ?? new Set()}
            onToggle={(value) => onFilters(toggleCategory(filters, field, value))}
            onClear={() => onFilters(clearField(filters, field))}
          />
        ))}

        {numericFields.map((field) => (
          <NumericFilter
            key={field}
            field={field}
            cells={cells}
            current={filters.numeric[field]}
            onRange={(min, max) => onFilters(setNumericRange(filters, field, { min, max }))}
            onClear={() => onFilters(clearField(filters, field))}
          />
        ))}
      </div>
    </div>
  );
}

function CategoricalFilter({
  field,
  cells,
  selected,
  onToggle,
  onClear,
}: {
  field: string;
  cells: CellRecord[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(['group', 'cell_type_merge', 'dataset'].includes(field));
  const [query, setQuery] = useState('');
  const counts = useMemo(() => topValues(cells, field, 200), [cells, field]);
  const max = counts[0]?.count ?? 1;
  const visible = counts.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 40);

  return (
    <section className="rounded border border-line">
      <FilterHeader field={field} open={open} selectedCount={selected.size} onOpen={() => setOpen(!open)} onClear={onClear} />
      {open && (
        <div className="border-t border-line p-3">
          <input className="input mb-2 w-full" placeholder={`Search ${field}`} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {visible.map((item) => (
              <label key={item.label} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-panel">
                <input type="checkbox" checked={selected.has(item.label)} onChange={() => onToggle(item.label)} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="h-1.5 w-16 overflow-hidden rounded bg-slate-200">
                  <span className="block h-full rounded bg-teal" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
                </span>
                <span className="w-12 text-right text-xs text-slate-500">{item.count.toLocaleString()}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NumericFilter({
  field,
  cells,
  current,
  onRange,
  onClear,
}: {
  field: string;
  cells: CellRecord[];
  current?: { min: number; max: number };
  onRange: (min: number, max: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(['Age', 'SLEDAI', 'pct_counts_mt'].includes(field));
  const stats = useMemo(() => numericSummary(cells, field), [cells, field]);
  const bins = useMemo(() => histogram(cells, field, 18), [cells, field]);
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  if (!stats) return null;

  const min = current?.min ?? stats.min;
  const max = current?.max ?? stats.max;

  return (
    <section className="rounded border border-line">
      <FilterHeader field={field} open={open} selectedCount={current ? 1 : 0} onOpen={() => setOpen(!open)} onClear={onClear} />
      {open && (
        <div className="border-t border-line p-3">
          <div className="mb-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
            <span>Min {formatNumber(stats.min)}</span>
            <span>Mean {formatNumber(stats.mean)}</span>
            <span>Max {formatNumber(stats.max)}</span>
          </div>
          <div className="mb-3 flex h-14 items-end gap-0.5">
            {bins.map((bin) => (
              <div
                key={bin.label}
                className="flex-1 rounded-t bg-gold/70"
                title={`${bin.label}: ${bin.count}`}
                style={{ height: `${Math.max(3, (bin.count / maxCount) * 100)}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" value={min} onChange={(event) => onRange(Number(event.target.value), max)} />
            <input className="input" type="number" value={max} onChange={(event) => onRange(min, Number(event.target.value))} />
          </div>
        </div>
      )}
    </section>
  );
}

function FilterHeader({
  field,
  open,
  selectedCount,
  onOpen,
  onClear,
}: {
  field: string;
  open: boolean;
  selectedCount: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium" onClick={onOpen}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="truncate">{field}</span>
        {selectedCount > 0 && <span className="rounded bg-teal/10 px-1.5 py-0.5 text-xs text-teal">{selectedCount}</span>}
      </button>
      {selectedCount > 0 && (
        <button className="text-slate-500 hover:text-coral" onClick={onClear} title={`Clear ${field}`}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
