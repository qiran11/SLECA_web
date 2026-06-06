import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CircleDot, Table2, Users } from 'lucide-react';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { SidebarFilters } from './components/SidebarFilters';
import { UmapViewer } from './components/UmapViewer';
import { MetadataPanel } from './components/MetadataPanel';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ClinicalDashboard } from './components/ClinicalDashboard';
import { CellTypeBrowser } from './components/CellTypeBrowser';
import { SamplePatientSummary } from './components/SamplePatientSummary';
import { DATA_SOURCES, getDataSource, loadCellMetadata, loadCells, queryDenseUmapChunk, queryFilterSummary, queryParquetCells } from './data/loadData';
import { COLOR_FIELDS, applyFilters, emptyFilters, sampleCells } from './data/filters';
import { availableFields } from './data/transformData';
import { buildPatientAliases } from './utils/anonymize';
import { colorFor } from './utils/colors';
import type { CellRecord, DataSourceKey, DenseUmapData, FilterState, FilterSummary, SamplingMode, SelectedCell } from './types/cell';

type Page = 'browser' | 'overview' | 'clinical' | 'cellTypes' | 'samples';

const navItems: Array<{ page: Page; label: string; icon: typeof CircleDot }> = [
  { page: 'browser', label: 'UMAP', icon: CircleDot },
  { page: 'overview', label: 'Overview', icon: BarChart3 },
  { page: 'clinical', label: 'Clinical', icon: Activity },
  { page: 'cellTypes', label: 'Cell Types', icon: Users },
  { page: 'samples', label: 'Samples', icon: Table2 },
];

const MILLION_CHUNK_SIZE = 50000;

function samplingLimit(mode: SamplingMode): number {
  if (mode === 'million') return Number.POSITIVE_INFINITY;
  if (mode === 'sample300k') return 300000;
  if (mode === 'full') return 300000;
  if (mode === 'preview') return 10000;
  return 100000;
}

function denseColor(value: unknown): [number, number, number] {
  if (value === null || value === undefined || value === '') return [0.07, 0.09, 0.11];
  const hex = colorFor(String(value));
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export default function App() {
  const [cells, setCells] = useState<CellRecord[]>([]);
  const [sourceKey, setSourceKey] = useState<DataSourceKey>('parquet');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [colorBy, setColorBy] = useState('cell_type_merge');
  const [pointSize, setPointSize] = useState(4);
  const [opacity, setOpacity] = useState(0.78);
  const [samplingMode, setSamplingMode] = useState<SamplingMode>('sample100k');
  const [page, setPage] = useState<Page>('browser');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTotalRows, setServerTotalRows] = useState<number | null>(null);
  const [serverFilteredRows, setServerFilteredRows] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ loaded: number; target: number } | null>(null);
  const [denseData, setDenseData] = useState<DenseUmapData | null>(null);
  const [filterSummary, setFilterSummary] = useState<FilterSummary | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    setSelectedCell(null);
    setBatchProgress(null);
    setDenseData(null);
    setFilterSummary(null);

    if (sourceKey === 'parquet') return;

    loadCells(sourceKey)
      .then((records) => {
        if (!ignore) {
          setCells(records);
          setServerTotalRows(null);
          setServerFilteredRows(null);
          setBatchProgress(null);
          setDenseData(null);
          setFilterSummary(null);
          setFilters(emptyFilters());
          setSamplingMode(sourceKey === 'preview' ? 'preview' : 'sample100k');
        }
      })
      .catch((loadError: Error) => {
        if (!ignore) setError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [sourceKey]);

  useEffect(() => {
    if (sourceKey !== 'parquet') return;

    let ignore = false;
    setLoading(true);
    setError(null);
    setSelectedCell(null);

    if (samplingMode === 'million') {
      setCells([]);
      setBatchProgress({ loaded: 0, target: samplingLimit(samplingMode) });

      const loadBatches = async () => {
        let offset = 0;
        let loaded = 0;
        const summary = await queryFilterSummary(filters);
        const target = summary.filtered_rows;
        const positions = new Float32Array(target * 2);
        const colors = new Float32Array(target * 3);
        const cellIds: Array<string | number | null> = new Array(target);
        if (!ignore) {
          setFilterSummary(summary);
          setServerTotalRows(summary.total_rows);
          setServerFilteredRows(summary.filtered_rows);
          setBatchProgress({ loaded: 0, target });
        }

        while (!ignore && offset < target) {
          const response = await queryDenseUmapChunk(filters, MILLION_CHUNK_SIZE, offset, colorBy);
          const writable = Math.min(response.returned_rows, target - loaded);

          setServerTotalRows(response.total_rows);
          setServerFilteredRows(response.filtered_rows);

          for (let index = 0; index < writable; index += 1) {
            positions[(loaded + index) * 2] = response.x[index];
            positions[(loaded + index) * 2 + 1] = response.y[index];
            const rgb = denseColor(response.color?.[index]);
            colors[(loaded + index) * 3] = rgb[0];
            colors[(loaded + index) * 3 + 1] = rgb[1];
            colors[(loaded + index) * 3 + 2] = rgb[2];
            cellIds[loaded + index] = response.cell_id[index];
          }

          loaded += writable;
          setDenseData({ positions, colors, cellIds, loaded, target, totalFiltered: response.filtered_rows });
          setBatchProgress({ loaded, target });
          setLoading(false);

          offset += MILLION_CHUNK_SIZE;
          if (response.returned_rows < MILLION_CHUNK_SIZE || offset >= response.filtered_rows || loaded >= target) break;
          await new Promise((resolve) => window.setTimeout(resolve, 80));
        }
      };

      loadBatches()
        .catch((loadError: Error) => {
          if (!ignore) setError(loadError.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });

      return () => {
        ignore = true;
      };
    }

    queryParquetCells(filters, samplingLimit(samplingMode))
      .then((response) => {
        if (!ignore) {
          setCells(response.rows);
          setDenseData(null);
          setFilterSummary(null);
          setServerTotalRows(response.total_rows);
          setServerFilteredRows(response.filtered_rows);
          setBatchProgress(null);
        }
      })
      .catch((loadError: Error) => {
        if (!ignore) setError(loadError.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [colorBy, filters, samplingMode, sourceKey]);

  const filteredCells = useMemo(() => (sourceKey === 'parquet' ? cells : applyFilters(cells, filters)), [cells, filters, sourceKey]);
  const displayedCells = useMemo(
    () => (sourceKey === 'parquet' ? filteredCells : sampleCells(filteredCells, samplingMode)),
    [filteredCells, samplingMode, sourceKey],
  );
  const patientAliases = useMemo(() => buildPatientAliases(cells), [cells]);
  const colorFields = useMemo(
    () => (sourceKey === 'parquet' && samplingMode === 'million' ? COLOR_FIELDS : availableFields(cells, COLOR_FIELDS)),
    [cells, samplingMode, sourceKey],
  );
  const source = getDataSource(sourceKey);

  const resetFilters = () => {
    setFilters(emptyFilters());
    setSelectedCell(null);
  };

  const handleSource = (nextSource: DataSourceKey) => {
    setSourceKey(nextSource);
    setFilters(emptyFilters());
    setSelectedCell(null);
    setSamplingMode(nextSource === 'preview' ? 'preview' : 'sample100k');
    setBatchProgress(null);
    setDenseData(null);
    setFilterSummary(null);
  };

  const handleSelectCell = (cell: CellRecord) => {
    setSelectedCell(cell);
    if (sourceKey === 'parquet' && cell.cell_id !== undefined && cell.cell_id !== null) {
      loadCellMetadata(cell.cell_id)
        .then((metadata) => {
          if (metadata) setSelectedCell(metadata);
        })
        .catch(() => {
          // Keep the lightweight point metadata visible if the detail request fails.
        });
    }
  };

  return (
    <div className="min-h-screen bg-[#eef3f1] text-ink">
      <Header
        source={source}
        sources={DATA_SOURCES}
        totalCells={serverTotalRows ?? cells.length}
        filteredCells={serverFilteredRows ?? filteredCells.length}
        colorBy={colorBy}
        colorFields={colorFields}
        samplingMode={samplingMode}
        onColorBy={setColorBy}
        onReset={resetFilters}
        onSource={handleSource}
        onSamplingMode={setSamplingMode}
        filteredRows={filteredCells}
        aliases={patientAliases}
      />

      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1800px] gap-1 px-4">
          {navItems.map(({ page: itemPage, label, icon: Icon }) => (
            <button
              key={itemPage}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                page === itemPage
                  ? 'border-teal text-teal'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-ink'
              }`}
              onClick={() => setPage(itemPage)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <main className="mx-auto max-w-5xl p-8">
          <div className="rounded border border-coral/30 bg-white p-5 text-coral shadow-soft">{error}</div>
        </main>
      ) : page === 'browser' ? (
        <Layout
          sidebar={
            <SidebarFilters
              cells={cells}
              filters={filters}
              filteredCells={filteredCells}
              summary={samplingMode === 'million' ? filterSummary : null}
              onFilters={setFilters}
            />
          }
          main={
            <UmapViewer
              cells={displayedCells}
              colorBy={colorBy}
              pointSize={pointSize}
              opacity={opacity}
              loading={loading}
              totalFiltered={serverFilteredRows ?? filteredCells.length}
              aliases={patientAliases}
              denseMode={samplingMode === 'million'}
              denseData={denseData}
              batchProgress={batchProgress}
              onPointSize={setPointSize}
              onOpacity={setOpacity}
              onSelectCell={handleSelectCell}
            />
          }
          panel={
            <MetadataPanel
              selectedCell={selectedCell}
              cells={filteredCells}
              aliases={patientAliases}
              onClearSelected={() => setSelectedCell(null)}
            />
          }
        />
      ) : (
        <main className="mx-auto max-w-[1800px] p-4">
          {page === 'overview' && <OverviewDashboard cells={filteredCells} loading={loading} />}
          {page === 'clinical' && <ClinicalDashboard cells={filteredCells} loading={loading} />}
          {page === 'cellTypes' && (
            <CellTypeBrowser
              cells={filteredCells}
              colorBy={colorBy}
              onColorBy={setColorBy}
              onHighlight={(cellType) => {
                setFilters((current) => ({
                  categorical: {
                    ...current.categorical,
                    cell_type_merge: new Set([cellType]),
                  },
                  numeric: { ...current.numeric },
                }));
                setPage('browser');
              }}
              onBackToUmap={() => setPage('browser')}
            />
          )}
          {page === 'samples' && <SamplePatientSummary cells={filteredCells} />}
        </main>
      )}
    </div>
  );
}
