import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CircleDot, Home, Table2, Users } from 'lucide-react';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { SidebarFilters } from './components/SidebarFilters';
import { UmapViewer } from './components/UmapViewer';
import { MetadataPanel } from './components/MetadataPanel';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ClinicalDashboard } from './components/ClinicalDashboard';
import { CellTypeBrowser } from './components/CellTypeBrowser';
import { SamplePatientSummary } from './components/SamplePatientSummary';
import { DatasetLanding } from './components/DatasetLanding';
import { getDataSource, loadCellMetadata, loadCells, queryDenseColorChunk, queryDenseUmapChunk, queryFilterFacets, queryFilterSummary, queryParquetCells, querySummaryRows } from './data/loadData';
import { COLOR_FIELDS, applyFilters, emptyFilters, sampleCells } from './data/filters';
import { availableFields } from './data/transformData';
import { buildPatientAliases } from './utils/anonymize';
import { colorFor } from './utils/colors';
import type { CellRecord, DataSourceKey, DenseUmapData, FilterState, FilterSummary, SamplingMode, SelectedCell } from './types/cell';

type Page = 'home' | 'browser' | 'overview' | 'clinical' | 'cellTypes' | 'samples';

const navItems: Array<{ page: Page; label: string; icon: typeof CircleDot }> = [
  { page: 'browser', label: 'UMAP', icon: CircleDot },
  { page: 'overview', label: 'Overview', icon: BarChart3 },
  { page: 'clinical', label: 'Clinical', icon: Activity },
  { page: 'cellTypes', label: 'Cell Types', icon: Users },
  { page: 'samples', label: 'Samples', icon: Table2 },
];

const MILLION_CHUNK_SIZE = 50000;
const DASHBOARD_SAMPLE_SIZE = 100000;

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

function denseDrawBucket(colors: Float32Array, index: number) {
  const offset = index * 3;
  const r = colors[offset];
  const g = colors[offset + 1];
  const b = colors[offset + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  if (luminance > 0.82 && saturation < 0.28) return 0;
  if (luminance > 0.86 && saturation < 0.45) return 1;
  return 2;
}

function createDenseRenderOrder(colors: Float32Array, count: number) {
  const bucketCounts = [0, 0, 0];
  for (let index = 0; index < count; index += 1) {
    bucketCounts[denseDrawBucket(colors, index)] += 1;
  }

  const offsets = [0, bucketCounts[0], bucketCounts[0] + bucketCounts[1]];
  const cursors = [...offsets];
  const order = new Uint32Array(count);
  for (let index = 0; index < count; index += 1) {
    const bucket = denseDrawBucket(colors, index);
    order[cursors[bucket]] = index;
    cursors[bucket] += 1;
  }
  return order;
}

function reorderDenseDataForDrawing(data: DenseUmapData, colors: Float32Array) {
  const order = createDenseRenderOrder(colors, data.loaded);
  const positions = new Float32Array(data.positions.length);
  const orderedColors = new Float32Array(colors.length);
  const cellIds: Array<string | number | null> = new Array(data.cellIds.length);

  for (let targetIndex = 0; targetIndex < data.loaded; targetIndex += 1) {
    const sourceIndex = order[targetIndex];
    positions[targetIndex * 2] = data.positions[sourceIndex * 2];
    positions[targetIndex * 2 + 1] = data.positions[sourceIndex * 2 + 1];
    orderedColors[targetIndex * 3] = colors[sourceIndex * 3];
    orderedColors[targetIndex * 3 + 1] = colors[sourceIndex * 3 + 1];
    orderedColors[targetIndex * 3 + 2] = colors[sourceIndex * 3 + 2];
    cellIds[targetIndex] = data.cellIds[sourceIndex];
  }

  if (data.loaded < data.target) {
    positions.set(data.positions.subarray(data.loaded * 2), data.loaded * 2);
    orderedColors.set(colors.subarray(data.loaded * 3), data.loaded * 3);
    for (let index = data.loaded; index < data.cellIds.length; index += 1) {
      cellIds[index] = data.cellIds[index];
    }
  }

  return {
    ...data,
    positions,
    colors: orderedColors,
    cellIds,
    renderOrder: undefined,
  };
}

function serializeFilters(filters: FilterState): string {
  return JSON.stringify({
    categorical: Object.fromEntries(
      Object.entries(filters.categorical)
        .filter(([, values]) => values.size > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([field, values]) => [field, Array.from(values).sort()]),
    ),
    numeric: Object.fromEntries(Object.entries(filters.numeric).sort(([a], [b]) => a.localeCompare(b))),
  });
}

export default function App() {
  const [cells, setCells] = useState<CellRecord[]>([]);
  const [sourceKey, setSourceKey] = useState<DataSourceKey>('parquet');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [colorBy, setColorBy] = useState('Cell subtype');
  const [pointSize, setPointSize] = useState(3);
  const [opacity, setOpacity] = useState(0.75);
  const [samplingMode, setSamplingMode] = useState<SamplingMode>('million');
  const [page, setPage] = useState<Page>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTotalRows, setServerTotalRows] = useState<number | null>(null);
  const [serverFilteredRows, setServerFilteredRows] = useState<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ loaded: number; target: number } | null>(null);
  const [denseData, setDenseData] = useState<DenseUmapData | null>(null);
  const [filterSummary, setFilterSummary] = useState<FilterSummary | null>(null);
  const [filterFacets, setFilterFacets] = useState<FilterSummary | null>(null);
  const [summaryRows, setSummaryRows] = useState<Array<Record<string, string | number>> | null>(null);
  const [sampleSummaryRows, setSampleSummaryRows] = useState<Array<Record<string, string | number>> | null>(null);
  const [summaryRowsMode, setSummaryRowsMode] = useState<'sample' | 'patient'>('sample');
  const [denseColorCache, setDenseColorCache] = useState<Record<string, Float32Array>>({});
  const [denseColorField, setDenseColorField] = useState<string | null>(null);
  const filtersKey = useMemo(() => serializeFilters(filters), [filters]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    setSelectedCell(null);
    setBatchProgress(null);
    setDenseData(null);
    setFilterSummary(null);
    setFilterFacets(null);
    setSummaryRows(null);
    setSampleSummaryRows(null);
    setDenseColorCache({});
    setDenseColorField(null);

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
          setFilterFacets(null);
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
      setDenseColorCache({});
      setDenseColorField(null);
      setBatchProgress({ loaded: 0, target: samplingLimit(samplingMode) });

      const loadBatches = async () => {
        let offset = 0;
        let loaded = 0;
        const [summary, facets] = await Promise.all([queryFilterSummary(filters), queryFilterFacets(filters)]);
        const target = summary.filtered_rows;
        const positions = new Float32Array(target * 2);
        const colors = new Float32Array(target * 3);
        const initialColors = new Float32Array(target * 3);
        const cellIds: Array<string | number | null> = new Array(target);
        let bounds: DenseUmapData['bounds'] | null = null;
        if (!ignore) {
          setFilterSummary(summary);
          setFilterFacets(facets);
          setSummaryRows(null);
          setSampleSummaryRows(null);
          setServerTotalRows(summary.total_rows);
          setServerFilteredRows(summary.filtered_rows);
          setBatchProgress({ loaded: 0, target });
        }

        queryParquetCells(filters, DASHBOARD_SAMPLE_SIZE)
          .then((response) => {
            if (!ignore) setCells(response.rows);
          })
          .catch(() => {
            // Dense UMAP remains usable even if the dashboard sample request fails.
          });

        querySummaryRows(filters, 'sample')
          .then((rows) => {
            if (!ignore) setSampleSummaryRows(rows);
          })
          .catch(() => {
            if (!ignore) setSampleSummaryRows(null);
          });

        while (!ignore && offset < target) {
          const response = await queryDenseUmapChunk(filters, MILLION_CHUNK_SIZE, offset, colorBy);
          const writable = Math.min(response.returned_rows, target - loaded);

          setServerTotalRows(response.total_rows);
          setServerFilteredRows(response.filtered_rows);
          if (!bounds && response.bounds) {
            bounds = {
              minX: response.bounds.min_x,
              maxX: response.bounds.max_x,
              minY: response.bounds.min_y,
              maxY: response.bounds.max_y,
            };
          }

          for (let index = 0; index < writable; index += 1) {
            positions[(loaded + index) * 2] = response.x[index];
            positions[(loaded + index) * 2 + 1] = response.y[index];
            const rgb = denseColor(response.color?.[index]);
            colors[(loaded + index) * 3] = rgb[0];
            colors[(loaded + index) * 3 + 1] = rgb[1];
            colors[(loaded + index) * 3 + 2] = rgb[2];
            initialColors[(loaded + index) * 3] = rgb[0];
            initialColors[(loaded + index) * 3 + 1] = rgb[1];
            initialColors[(loaded + index) * 3 + 2] = rgb[2];
            cellIds[loaded + index] = response.cell_id[index];
          }

          loaded += writable;
          setDenseData({
            positions,
            colors,
            cellIds,
            loaded,
            target,
            totalFiltered: response.filtered_rows,
            bounds: bounds ?? { minX: -1, maxX: 1, minY: -1, maxY: 1 },
          });
          setBatchProgress({ loaded, target });
          setLoading(false);

          offset += MILLION_CHUNK_SIZE;
          if (response.returned_rows < MILLION_CHUNK_SIZE || offset >= response.filtered_rows || loaded >= target) break;
          await new Promise((resolve) => window.setTimeout(resolve, 80));
        }

        if (!ignore) {
          const cacheKey = `${filtersKey}::${colorBy}`;
          setDenseColorCache({ [cacheKey]: initialColors });
          setDenseColorField(colorBy);
          setDenseData((current) =>
            current && current.loaded === current.target
              ? reorderDenseDataForDrawing(current, initialColors)
              : current,
          );
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
          setFilterFacets(null);
          setSummaryRows(null);
          setSampleSummaryRows(null);
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
  }, [filters, filtersKey, samplingMode, sourceKey]);

  useEffect(() => {
    if (sourceKey !== 'parquet' || samplingMode !== 'million' || !denseData) return;
    if (denseData.loaded < denseData.target) return;
    if (denseColorField === colorBy) return;

    const cacheKey = `${filtersKey}::${colorBy}`;
    const cached = denseColorCache[cacheKey];
    if (cached) {
      setDenseData((current) =>
        current
          ? reorderDenseDataForDrawing(current, cached)
          : current,
      );
      setDenseColorField(colorBy);
      return;
    }

    let ignore = false;
    const loadColors = async () => {
      let offset = 0;
      let loaded = 0;
      const colors = new Float32Array(denseData.target * 3);

      while (!ignore && offset < denseData.target) {
        const response = await queryDenseColorChunk(filters, MILLION_CHUNK_SIZE, offset, colorBy);
        const writable = Math.min(response.returned_rows, denseData.target - loaded);
        for (let index = 0; index < writable; index += 1) {
          const rgb = denseColor(response.color?.[index]);
          colors[(loaded + index) * 3] = rgb[0];
          colors[(loaded + index) * 3 + 1] = rgb[1];
          colors[(loaded + index) * 3 + 2] = rgb[2];
        }
        loaded += writable;
        offset += MILLION_CHUNK_SIZE;
        if (response.returned_rows < MILLION_CHUNK_SIZE || offset >= response.filtered_rows || loaded >= denseData.target) break;
        await new Promise((resolve) => window.setTimeout(resolve, 30));
      }

      if (!ignore) {
        setDenseColorCache((current) => ({ ...current, [cacheKey]: colors }));
        setDenseData((current) =>
          current
            ? reorderDenseDataForDrawing(current, colors)
            : current,
        );
        setDenseColorField(colorBy);
      }
    };

    loadColors().catch((loadError: Error) => {
      if (!ignore) setError(loadError.message);
    });

    return () => {
      ignore = true;
    };
  }, [colorBy, denseColorCache, denseColorField, denseData, filters, filtersKey, samplingMode, sourceKey]);

  useEffect(() => {
    if (sourceKey !== 'parquet' || samplingMode !== 'million') return;

    let ignore = false;
    querySummaryRows(filters, summaryRowsMode)
      .then((rows) => {
        if (!ignore) setSummaryRows(rows);
      })
      .catch(() => {
        if (!ignore) setSummaryRows(null);
      });

    return () => {
      ignore = true;
    };
  }, [filters, samplingMode, sourceKey, summaryRowsMode]);

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

  const handleSelectCell = (cell: CellRecord) => {
    setSelectedCell(cell);
    const selectedId = cell.cell_id ?? cell['Cell ID'];
    if (sourceKey === 'parquet' && selectedId !== undefined && selectedId !== null) {
      loadCellMetadata(selectedId)
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
        totalCells={serverTotalRows ?? cells.length}
        filteredCells={serverFilteredRows ?? filteredCells.length}
        colorBy={colorBy}
        colorFields={colorFields}
        onColorBy={setColorBy}
        onReset={resetFilters}
        filteredRows={filteredCells}
        aliases={patientAliases}
        compact={page === 'home'}
      />

      {page !== 'home' && (
        <div className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-[1800px] gap-1 px-4">
            <button
              className="flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-ink"
              onClick={() => setPage('home')}
            >
              <Home size={17} />
              Cover
            </button>
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
      )}

      {error ? (
        <main className="mx-auto max-w-5xl p-8">
          <div className="rounded border border-coral/30 bg-white p-5 text-coral shadow-soft">{error}</div>
        </main>
      ) : page === 'home' ? (
        <DatasetLanding onNavigate={setPage} />
      ) : page === 'browser' ? (
        <Layout
          sidebar={
            <SidebarFilters
              cells={cells}
              filters={filters}
              filteredCells={filteredCells}
              summary={samplingMode === 'million' ? filterSummary : null}
              facets={samplingMode === 'million' ? filterFacets : null}
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
              legendCounts={samplingMode === 'million' ? filterSummary?.categorical[colorBy] : null}
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
              summary={samplingMode === 'million' ? filterSummary : null}
              onClearSelected={() => setSelectedCell(null)}
            />
          }
        />
      ) : (
        <main className="mx-auto max-w-[1800px] p-4">
          {page === 'overview' && (
            <OverviewDashboard
              cells={filteredCells}
              loading={loading}
              summary={samplingMode === 'million' ? filterSummary : null}
              sampleRows={samplingMode === 'million' ? sampleSummaryRows : null}
            />
          )}
          {page === 'clinical' && (
            <ClinicalDashboard
              cells={filteredCells}
              loading={loading}
              sampleRows={samplingMode === 'million' ? sampleSummaryRows : null}
            />
          )}
          {page === 'cellTypes' && (
            <CellTypeBrowser
              cells={filteredCells}
              colorBy={colorBy}
              cellTypeCounts={samplingMode === 'million' ? filterSummary?.categorical['Cell subtype'] : null}
              onColorBy={setColorBy}
              onHighlight={(cellType) => {
                setFilters((current) => ({
                  categorical: {
                    ...current.categorical,
                    'Cell subtype': new Set([cellType]),
                  },
                  numeric: { ...current.numeric },
                }));
                setPage('browser');
              }}
              onBackToUmap={() => setPage('browser')}
            />
          )}
          {page === 'samples' && (
            <SamplePatientSummary
              cells={filteredCells}
              serverRows={samplingMode === 'million' ? summaryRows : null}
              onMode={setSummaryRowsMode}
            />
          )}
        </main>
      )}
    </div>
  );
}
