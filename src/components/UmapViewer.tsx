import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { SlidersHorizontal } from 'lucide-react';
import type { CellRecord } from '../types/cell';
import { numericValue } from '../data/filters';
import { valueLabel } from '../data/transformData';
import { colorFor } from '../utils/colors';
import { patientAlias } from '../utils/anonymize';

type UmapViewerProps = {
  cells: CellRecord[];
  colorBy: string;
  pointSize: number;
  opacity: number;
  totalFiltered: number;
  loading: boolean;
  aliases: Map<string, string>;
  denseMode?: boolean;
  batchProgress?: { loaded: number; target: number } | null;
  onPointSize: (value: number) => void;
  onOpacity: (value: number) => void;
  onSelectCell: (cell: CellRecord) => void;
};

export function UmapViewer({
  cells,
  colorBy,
  pointSize,
  opacity,
  totalFiltered,
  loading,
  aliases,
  denseMode = false,
  batchProgress,
  onPointSize,
  onOpacity,
  onSelectCell,
}: UmapViewerProps) {
  const numericColor = cells.some((cell) => numericValue(cell[colorBy]) !== null);
  const plotData = useMemo(() => {
    const valid = cells.filter((cell) => numericValue(cell.UMAP_1) !== null && numericValue(cell.UMAP_2) !== null);
    const markerColor = denseMode
      ? '#111827'
      : numericColor
      ? valid.map((cell) => numericValue(cell[colorBy]) ?? null)
      : valid.map((cell) => colorFor(valueLabel(cell[colorBy])));

    return {
      valid,
      trace: {
        type: 'scattergl' as const,
        mode: 'markers' as const,
        x: valid.map((cell) => numericValue(cell.UMAP_1)),
        y: valid.map((cell) => numericValue(cell.UMAP_2)),
        customdata: valid.map((_, index) => index),
        text: valid.map((cell) => tooltipText(cell, aliases)),
        hoverinfo: 'text' as const,
        marker: {
          size: pointSize,
          opacity,
          color: markerColor,
          colorscale: !denseMode && numericColor ? 'Viridis' : undefined,
          showscale: !denseMode && numericColor,
          line: { width: 0 },
        },
      },
    };
  }, [aliases, cells, colorBy, denseMode, numericColor, opacity, pointSize]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold">UMAP Viewer</div>
          <div className="text-xs text-slate-500">
            Showing {plotData.valid.length.toLocaleString()} of {totalFiltered.toLocaleString()} filtered cells
            {denseMode ? ' - batched black-point mode' : ''}
          </div>
          {batchProgress && (
            <div className="mt-2 h-1.5 w-72 overflow-hidden rounded bg-slate-200">
              <div
                className="h-full rounded bg-teal"
                style={{ width: `${Math.min(100, (batchProgress.loaded / Math.max(batchProgress.target, 1)) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Control label="Point size" value={pointSize} min={2} max={10} step={1} onChange={onPointSize} />
          <Control label="Opacity" value={opacity} min={0.1} max={1} step={0.05} onChange={onOpacity} />
        </div>
      </div>

      <div className="relative min-h-[520px] flex-1">
        {loading && <CenterNote>Loading cells...</CenterNote>}
        {!loading && cells.length === 0 && <CenterNote>No cells match the current filters.</CenterNote>}
        {!loading && cells.length > 0 && (
          <Plot
            data={[plotData.trace]}
            layout={{
              autosize: true,
              margin: { l: 38, r: 16, t: 12, b: 36 },
              paper_bgcolor: '#f8faf9',
              plot_bgcolor: '#f8faf9',
              dragmode: 'pan',
              xaxis: { title: 'UMAP_1', zeroline: false, gridcolor: '#dfe7e5' },
              yaxis: { title: 'UMAP_2', zeroline: false, gridcolor: '#dfe7e5' },
              hovermode: 'closest',
            }}
            config={{ responsive: true, displaylogo: false, scrollZoom: true }}
            className="h-full w-full"
            style={{ width: '100%', height: '100%' }}
            onClick={(event) => {
              const point = event.points?.[0];
              const index = point?.customdata as number | undefined;
              if (index !== undefined) onSelectCell(plotData.valid[index]);
            }}
          />
        )}
      </div>
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <SlidersHorizontal size={15} />
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span className="w-8 text-right">{value}</span>
    </label>
  );
}

function CenterNote({ children }: { children: string }) {
  return <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">{children}</div>;
}

function tooltipText(cell: CellRecord, aliases: Map<string, string>) {
  const fields = ['cell_id', 'cell_type_merge', 'cell_type_major_n', 'group', 'dataset', 'sample', 'SLEDAI', 'Age', 'sex'];
  return [...fields.map((field) => `${field}: ${valueLabel(cell[field])}`), `Patient: ${patientAlias(cell, aliases)}`].join('<br>');
}
