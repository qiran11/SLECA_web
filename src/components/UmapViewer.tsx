import { useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { SlidersHorizontal } from 'lucide-react';
import type { CellRecord, DenseUmapData } from '../types/cell';
import { NUMERIC_FIELDS, numericValue } from '../data/filters';
import { valueLabel } from '../data/transformData';
import { colorFor } from '../utils/colors';
import type { CategoryCount } from '../types/cell';

type UmapViewerProps = {
  cells: CellRecord[];
  colorBy: string;
  pointSize: number;
  opacity: number;
  totalFiltered: number;
  loading: boolean;
  aliases: Map<string, string>;
  denseMode?: boolean;
  denseData?: DenseUmapData | null;
  legendCounts?: CategoryCount[] | null;
  batchProgress?: { loaded: number; target: number } | null;
  onPointSize: (value: number) => void;
  onOpacity: (value: number) => void;
  onSelectCell: (cell: CellRecord) => void;
};

type DenseGlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  supportsUintIndices: boolean;
  positionLocation: number;
  colorLocation: number;
  zoomLocation: WebGLUniformLocation | null;
  panLocation: WebGLUniformLocation | null;
  centerLocation: WebGLUniformLocation | null;
  scaleLocation: WebGLUniformLocation | null;
  sizeLocation: WebGLUniformLocation | null;
  opacityLocation: WebGLUniformLocation | null;
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
  denseData,
  legendCounts,
  batchProgress,
  onPointSize,
  onOpacity,
  onSelectCell,
}: UmapViewerProps) {
  const numericColor = NUMERIC_FIELDS.includes(colorBy) && cells.some((cell) => numericValue(cell[colorBy]) !== null);
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

  const renderedCount = denseMode ? denseData?.loaded ?? 0 : plotData.valid.length;
  const legendItems = useMemo(() => {
    const fromSummary = legendCounts?.filter((item) => item.label && item.count > 0) ?? [];
    if (fromSummary.length > 0) return fromSummary;

    const counts = new Map<string, number>();
    for (const cell of cells) {
      const label = valueLabel(cell[colorBy]);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [cells, colorBy, legendCounts]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line bg-white px-4 py-3">
        <div className="flex min-h-[56px] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">UMAP Viewer</div>
            <div className="text-xs text-slate-500">
              Showing {renderedCount.toLocaleString()} of {totalFiltered.toLocaleString()} filtered cells
              {denseMode ? ' - batched WebGL mode' : ''}
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
          {!loading && renderedCount > 0 && (
            <div className="flex shrink-0 flex-wrap items-end justify-end gap-3 self-end pb-1">
              <Control label="Point size" value={pointSize} min={1} max={8} step={1} onChange={onPointSize} />
              <Control label="Opacity" value={opacity} min={0.1} max={1} step={0.05} onChange={onOpacity} />
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-[520px] flex-1">
        {loading && <CenterNote>Loading cells...</CenterNote>}
        {!loading && renderedCount === 0 && <CenterNote>No cells match the current filters.</CenterNote>}
        {!loading && renderedCount > 0 && legendItems.length > 0 && (
          <ColorLegend title={colorBy} items={legendItems} />
        )}
        {!loading && renderedCount > 0 && denseMode && denseData && (
          <DenseUmapCanvas
            data={denseData}
            pointSize={pointSize}
            opacity={opacity}
            onSelectCell={onSelectCell}
          />
        )}
        {!loading && renderedCount > 0 && !denseMode && (
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

function ColorLegend({ title, items, compact = false }: { title: string; items: CategoryCount[]; compact?: boolean }) {
  const containerClass = compact
    ? 'mt-2 max-w-[720px]'
    : 'absolute left-24 top-4 z-20 w-[180px] max-w-[calc(100%-7rem)]';

  return (
    <div className={`${containerClass} rounded border border-line/80 bg-white/90 p-2 text-xs shadow-soft backdrop-blur`}>
      <div className="mb-1.5 font-semibold text-ink">
        Color by {title} <span className="font-normal text-slate-500">({items.length})</span>
      </div>
      <div className={`${compact ? 'flex max-h-24 flex-wrap gap-x-3 gap-y-1 overflow-y-auto pr-1' : 'grid max-h-72 gap-1.5 overflow-auto pr-1'}`}>
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-3 w-3 shrink-0 rounded-sm border border-slate-300"
              style={{ backgroundColor: colorFor(item.label) }}
            />
            <span className={`${compact ? 'max-w-[150px]' : 'min-w-0 flex-1'} truncate text-slate-700`} title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">{compactCount(item.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function compactCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString();
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
  const clamp = (nextValue: number) => Math.max(min, Math.min(max, Number(nextValue.toFixed(2))));

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <SlidersHorizontal size={15} />
      {label}
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded border border-line bg-white text-sm font-semibold leading-none text-slate-600 transition hover:border-teal hover:text-teal"
        onClick={() => onChange(clamp(value - step))}
        title={`Decrease ${label}`}
      >
        -
      </button>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded border border-line bg-white text-sm font-semibold leading-none text-slate-600 transition hover:border-teal hover:text-teal"
        onClick={() => onChange(clamp(value + step))}
        title={`Increase ${label}`}
      >
        +
      </button>
      <span className="w-8 text-right">{value}</span>
    </label>
  );
}

function CenterNote({ children }: { children: string }) {
  return <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">{children}</div>;
}

function DenseUmapCanvas({
  data,
  pointSize,
  opacity,
  onSelectCell,
}: {
  data: DenseUmapData;
  pointSize: number;
  opacity: number;
  onSelectCell: (cell: CellRecord) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const glStateRef = useRef<DenseGlState | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;

    const program = createProgram(gl);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const colorLocation = gl.getAttribLocation(program, 'a_color');
    const zoomLocation = gl.getUniformLocation(program, 'u_zoom');
    const panLocation = gl.getUniformLocation(program, 'u_pan');
    const centerLocation = gl.getUniformLocation(program, 'u_center');
    const scaleLocation = gl.getUniformLocation(program, 'u_scale');
    const sizeLocation = gl.getUniformLocation(program, 'u_pointSize');
    const opacityLocation = gl.getUniformLocation(program, 'u_opacity');
    const buffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const supportsUintIndices = Boolean(gl.getExtension('OES_element_index_uint'));
    if (!buffer || !colorBuffer || !indexBuffer) return;

    glStateRef.current = {
      gl,
      program,
      buffer,
      colorBuffer,
      indexBuffer,
      supportsUintIndices,
      positionLocation,
      colorLocation,
      zoomLocation,
      panLocation,
      centerLocation,
      scaleLocation,
      sizeLocation,
      opacityLocation,
    };

    const observer = new ResizeObserver(() => {
      if (glStateRef.current) renderDenseCanvas(canvas, data, pointSize, opacity, viewRef.current, glStateRef.current);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const state = glStateRef.current;
    if (!canvas || !state) return;
    const upload = data.positions.subarray(0, data.loaded * 2);
    const colorUpload = data.colors.subarray(0, data.loaded * 3);
    state.gl.bindBuffer(state.gl.ARRAY_BUFFER, state.buffer);
    state.gl.bufferData(state.gl.ARRAY_BUFFER, upload, state.gl.STATIC_DRAW);
    state.gl.bindBuffer(state.gl.ARRAY_BUFFER, state.colorBuffer);
    state.gl.bufferData(state.gl.ARRAY_BUFFER, colorUpload, state.gl.STATIC_DRAW);
    if (data.renderOrder && state.supportsUintIndices) {
      state.gl.bindBuffer(state.gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer);
      state.gl.bufferData(state.gl.ELEMENT_ARRAY_BUFFER, data.renderOrder.subarray(0, data.loaded), state.gl.STATIC_DRAW);
    }
    renderDenseCanvas(canvas, data, pointSize, opacity, viewRef.current, state);
  }, [data, opacity, pointSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const state = glStateRef.current;
    if (!canvas || !state) return;
    renderDenseCanvas(canvas, data, pointSize, opacity, view, state);
  }, [data.loaded, opacity, pointSize, view]);

  const toClip = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((event.clientY - rect.top) / rect.height) * -2 + 1,
    };
  };

  const selectNearest = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const clip = toClip(event);
    const targetX = (clip.x - viewRef.current.panX) / viewRef.current.zoom;
    const targetY = (clip.y - viewRef.current.panY) / viewRef.current.zoom;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const threshold = 0.0008 / Math.max(viewRef.current.zoom, 0.5);
    const projection = denseProjection(data, canvasRef.current!);

    for (let index = 0; index < data.loaded; index += 1) {
      const projected = projectDensePoint(data.positions[index * 2], data.positions[index * 2 + 1], projection);
      const dx = projected.x - targetX;
      const dy = projected.y - targetY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestDistance < threshold) onSelectCell({ cell_id: data.cellIds[bestIndex] });
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-crosshair"
      onMouseDown={(event) => {
        dragRef.current = { x: event.clientX, y: event.clientY };
      }}
      onMouseMove={(event) => {
        if (!dragRef.current) return;
        const dx = ((event.clientX - dragRef.current.x) / event.currentTarget.clientWidth) * 2;
        const dy = -((event.clientY - dragRef.current.y) / event.currentTarget.clientHeight) * 2;
        dragRef.current = { x: event.clientX, y: event.clientY };
        setView((current) => ({ ...current, panX: current.panX + dx, panY: current.panY + dy }));
      }}
      onMouseUp={() => {
        dragRef.current = null;
      }}
      onMouseLeave={() => {
        dragRef.current = null;
      }}
      onClick={selectNearest}
      onWheel={(event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.15 : 0.87;
        setView((current) => ({ ...current, zoom: Math.max(0.25, Math.min(40, current.zoom * factor)) }));
      }}
    />
  );
}

function renderDenseCanvas(
  canvas: HTMLCanvasElement,
  data: DenseUmapData,
  pointSize: number,
  opacity: number,
  view: { zoom: number; panX: number; panY: number },
  state: DenseGlState,
) {
  const { gl } = state;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
  const height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  const projection = denseProjection(data, canvas);
  gl.clearColor(0.972, 0.98, 0.976, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.enableVertexAttribArray(state.positionLocation);
  gl.vertexAttribPointer(state.positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.enableVertexAttribArray(state.colorLocation);
  gl.vertexAttribPointer(state.colorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.uniform1f(state.zoomLocation, view.zoom);
  gl.uniform2f(state.panLocation, view.panX, view.panY);
  gl.uniform2f(state.centerLocation, projection.centerX, projection.centerY);
  gl.uniform2f(state.scaleLocation, projection.scaleX, projection.scaleY);
  gl.uniform1f(state.sizeLocation, pointSize * window.devicePixelRatio);
  gl.uniform1f(state.opacityLocation, opacity);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (data.renderOrder && state.supportsUintIndices) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer);
    gl.drawElements(gl.POINTS, data.loaded, gl.UNSIGNED_INT, 0);
  } else {
    gl.drawArrays(gl.POINTS, 0, data.loaded);
  }
}

function denseProjection(data: DenseUmapData, canvas: HTMLCanvasElement) {
  const width = Math.max(1, canvas.clientWidth || canvas.width || 1);
  const height = Math.max(1, canvas.clientHeight || canvas.height || 1);
  const aspect = width / height;
  const centerX = (data.bounds.minX + data.bounds.maxX) / 2;
  const centerY = (data.bounds.minY + data.bounds.maxY) / 2;
  const rangeX = Math.max(data.bounds.maxX - data.bounds.minX, 1e-12);
  const rangeY = Math.max(data.bounds.maxY - data.bounds.minY, 1e-12);
  const scaleY = Math.max(rangeY, rangeX / aspect);
  const scaleX = scaleY * aspect;
  return { centerX, centerY, scaleX, scaleY };
}

function projectDensePoint(x: number, y: number, projection: ReturnType<typeof denseProjection>) {
  return {
    x: ((x - projection.centerX) / projection.scaleX) * 1.9,
    y: ((y - projection.centerY) / projection.scaleY) * 1.9,
  };
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      attribute vec3 a_color;
      uniform float u_zoom;
      uniform vec2 u_pan;
      uniform vec2 u_center;
      uniform vec2 u_scale;
      uniform float u_pointSize;
      varying vec3 v_color;
      void main() {
        vec2 projected = vec2(
          (a_position.x - u_center.x) / u_scale.x,
          (a_position.y - u_center.y) / u_scale.y
        ) * 1.9;
        gl_Position = vec4(projected * u_zoom + u_pan, 0.0, 1.0);
        gl_PointSize = u_pointSize;
        v_color = a_color;
      }
    `,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform float u_opacity;
      varying vec3 v_color;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        if (dot(center, center) > 0.25) discard;
        gl_FragColor = vec4(v_color, u_opacity);
      }
    `,
  );
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create WebGL program');
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Could not link WebGL program');
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Could not compile WebGL shader');
  }
  return shader;
}

function tooltipText(cell: CellRecord, aliases: Map<string, string>) {
  const fields = ['Cell ID', 'Major cell type', 'Cell subtype', 'Group', 'Origin', 'Dataset', 'Sample', 'Sex', 'Age', 'Age group', 'SLEDAI'];
  return fields.map((field) => `${field}: ${valueLabel(cell[field])}`).join('<br>');
}
