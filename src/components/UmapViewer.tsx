import { useEffect, useMemo, useRef, useState } from 'react';
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
        {!loading && cells.length > 0 && denseMode && (
          <DenseUmapCanvas
            cells={plotData.valid}
            pointSize={pointSize}
            opacity={opacity}
            onSelectCell={onSelectCell}
          />
        )}
        {!loading && cells.length > 0 && !denseMode && (
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

function DenseUmapCanvas({
  cells,
  pointSize,
  opacity,
  onSelectCell,
}: {
  cells: CellRecord[];
  pointSize: number;
  opacity: number;
  onSelectCell: (cell: CellRecord) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const pointData = useMemo(() => {
    const xs = cells.map((cell) => numericValue(cell.UMAP_1)).filter((value): value is number => value !== null);
    const ys = cells.map((cell) => numericValue(cell.UMAP_2)).filter((value): value is number => value !== null);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scaleX = maxX - minX || 1;
    const scaleY = maxY - minY || 1;
    const positions = new Float32Array(cells.length * 2);

    cells.forEach((cell, index) => {
      const x = numericValue(cell.UMAP_1) ?? minX;
      const y = numericValue(cell.UMAP_2) ?? minY;
      positions[index * 2] = ((x - minX) / scaleX) * 2 - 1;
      positions[index * 2 + 1] = -(((y - minY) / scaleY) * 2 - 1);
    });

    return { positions, count: cells.length };
  }, [cells]);

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
    const zoomLocation = gl.getUniformLocation(program, 'u_zoom');
    const panLocation = gl.getUniformLocation(program, 'u_pan');
    const sizeLocation = gl.getUniformLocation(program, 'u_pointSize');
    const opacityLocation = gl.getUniformLocation(program, 'u_opacity');
    const buffer = gl.createBuffer();

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      const height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.972, 0.98, 0.976, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, pointData.positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(zoomLocation, viewRef.current.zoom);
      gl.uniform2f(panLocation, viewRef.current.panX, viewRef.current.panY);
      gl.uniform1f(sizeLocation, pointSize * window.devicePixelRatio);
      gl.uniform1f(opacityLocation, opacity);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, pointData.count);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [opacity, pointData, pointSize, view]);

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

    for (let index = 0; index < pointData.count; index += 1) {
      const dx = pointData.positions[index * 2] - targetX;
      const dy = pointData.positions[index * 2 + 1] - targetY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestDistance < threshold) onSelectCell(cells[bestIndex]);
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

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      uniform float u_zoom;
      uniform vec2 u_pan;
      uniform float u_pointSize;
      void main() {
        gl_Position = vec4(a_position * u_zoom + u_pan, 0.0, 1.0);
        gl_PointSize = u_pointSize;
      }
    `,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform float u_opacity;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        if (dot(center, center) > 0.25) discard;
        gl_FragColor = vec4(0.02, 0.03, 0.04, u_opacity);
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
  const fields = ['cell_id', 'cell_type_merge', 'cell_type_major_n', 'group', 'dataset', 'sample', 'SLEDAI', 'Age', 'sex'];
  return [...fields.map((field) => `${field}: ${valueLabel(cell[field])}`), `Patient: ${patientAlias(cell, aliases)}`].join('<br>');
}
