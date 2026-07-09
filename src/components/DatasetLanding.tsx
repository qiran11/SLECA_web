import { useMemo, useState } from 'react';
import { Activity, BarChart3, CircleDot, Database, Download, ExternalLink, Search, Table2, Users } from 'lucide-react';

const ZENODO_RECORD_ID = '19467523';
const ZENODO_RECORD_URL = `https://zenodo.org/records/${ZENODO_RECORD_ID}`;
const ATLAS_STATS = {
  datasets: 8,
  cells: 1_938_325,
  cellTypes: 54,
  samples: 366,
};

type DatasetInfo = {
  id: string;
  title: string;
  geo: string;
  origin: string;
  platform: string;
  downloads: Array<{ label: string; url: string }>;
};

const datasets: DatasetInfo[] = [
  {
    id: 'data1',
    title: 'Mapping systemic lupus erythematosus heterogeneity at the single-cell level',
    geo: 'GSE135779',
    origin: 'PBMC',
    platform: '10X',
    downloads: [
      { label: 'Control', url: 'https://zenodo.org/records/19467523/files/data1_control.tar.gz?download=1' },
      { label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data1_SLE.tar.gz?download=1' },
    ],
  },
  {
    id: 'data2',
    title: 'Single-cell transcriptomic analysis of B cells suggests that CD70 and LY9 may be novel features in patients with systemic lupus erythematosus',
    geo: 'GSE142016',
    origin: 'PBMC',
    platform: '10X',
    downloads: [{ label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data2_SLE.tar.gz?download=1' }],
  },
  {
    id: 'data3',
    title: 'Single-cell sequencing shows cellular heterogeneity of cutaneous lesions in lupus erythematosus',
    geo: 'GSE179633',
    origin: 'Biopsy',
    platform: '10X',
    downloads: [
      { label: 'Control', url: 'https://zenodo.org/records/19467523/files/data3_control.tar.gz?download=1' },
      { label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data3_SLE.tar.gz?download=1' },
    ],
  },
  {
    id: 'data4',
    title: 'Expression characteristics of interferon-stimulated genes and possible regulatory mechanisms in lupus patients using transcriptomics',
    geo: 'GSE162577',
    origin: 'PBMC',
    platform: '10X',
    downloads: [
      { label: 'Control', url: 'https://zenodo.org/records/19467523/files/data4_control.tar.gz?download=1' },
      { label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data4_SLE.tar.gz?download=1' },
    ],
  },
  {
    id: 'data5',
    title: 'Single-cell transcriptomics reveals distinct effector profiles of infiltrating T cells in lupus skin and kidney',
    geo: 'GSE186476',
    origin: 'Biopsy',
    platform: '10X',
    downloads: [
      { label: 'Control', url: 'https://zenodo.org/records/19467523/files/data5_control.tar.gz?download=1' },
      { label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data5_SLE.tar.gz?download=1' },
    ],
  },
  {
    id: 'data6',
    title: 'Single-cell RNA-seq reveals cell type-specific molecular and genetic associations to lupus',
    geo: 'GSE174188',
    origin: 'PBMC',
    platform: '10X',
    downloads: [
      { label: 'Control', url: 'https://zenodo.org/records/19467523/files/data6_control.tar.gz?download=1' },
      { label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data6_SLE.tar.gz?download=1' },
    ],
  },
  {
    id: 'data7',
    title: 'Impaired innate and adaptive immune responses to BNT162b2 SARS-CoV-2 vaccination in systemic lupus erythematosus',
    geo: 'GSE250024',
    origin: 'PBMC',
    platform: '10X',
    downloads: [{ label: 'SLE', url: 'https://zenodo.org/records/19467523/files/data7_SLE.tar.gz?download=1' }],
  },
  {
    id: 'data8',
    title: 'COVID-19 immune features revealed by a large-scale single-cell transcriptome atlas',
    geo: 'GSE158055',
    origin: 'PBMC',
    platform: '10X',
    downloads: [{ label: 'Control', url: 'https://zenodo.org/records/19467523/files/data8_control.tar.gz?download=1' }],
  },
];

export function DatasetLanding({ onNavigate }: { onNavigate: (page: 'browser' | 'overview' | 'clinical' | 'cellTypes' | 'samples') => void }) {
  const [query, setQuery] = useState('');

  const filteredDatasets = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return datasets;
    return datasets.filter((dataset) => Object.values(dataset).join(' ').toLowerCase().includes(text));
  }, [query]);

  return (
    <main className="mx-auto max-w-[1800px] space-y-4 p-4">
      <section className="relative overflow-hidden rounded border border-line bg-white shadow-soft">
        <div className="absolute inset-0 opacity-90">
          <div className="h-full w-full bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.16),transparent_26%),radial-gradient(circle_at_72%_28%,rgba(217,119,6,0.18),transparent_24%),radial-gradient(circle_at_68%_82%,rgba(15,118,110,0.18),transparent_26%)]" />
        </div>
        <div className="relative grid min-h-[560px] grid-cols-[1.05fr_0.95fr] items-center gap-8 px-10 py-10 max-lg:grid-cols-1 max-md:px-5 max-sm:py-6">
          <div className="max-w-4xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded border border-teal/30 bg-white/80 px-3 py-1 text-sm font-medium text-teal">
              <Database size={16} />
              SLE single-cell atlas repository
            </div>
            <h2 className="text-4xl font-semibold tracking-normal text-ink max-xl:text-3xl max-md:text-2xl">
              SLECA: a single-cell atlas of systemic lupus erythematosus enabling rare cell discovery using graph transformer
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 max-md:text-base">
              Browse harmonized UMAP embeddings, cohort metadata, clinical annotations, and cell type labels across public SLE single-cell studies.
            </p>
            <div className="mt-7 grid max-w-3xl grid-cols-5 gap-2 max-xl:grid-cols-3 max-sm:grid-cols-2">
              <NavButton label="UMAP" icon={CircleDot} onClick={() => onNavigate('browser')} />
              <NavButton label="Overview" icon={BarChart3} onClick={() => onNavigate('overview')} />
              <NavButton label="Clinical" icon={Activity} onClick={() => onNavigate('clinical')} />
              <NavButton label="Cell Types" icon={Users} onClick={() => onNavigate('cellTypes')} />
              <NavButton label="Samples" icon={Table2} onClick={() => onNavigate('samples')} />
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
              The complete processed data files are hosted in the Zenodo record. Use the record page for citation and metadata, or download individual dataset files from the table below.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="icon-button w-auto px-3" href="https://zenodo.org/records/19467523" target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Record
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <HeroMetric label="Datasets" value={ATLAS_STATS.datasets.toLocaleString()} />
            <HeroMetric label="Cells" value={ATLAS_STATS.cells.toLocaleString()} />
            <HeroMetric label="Cell Types" value={ATLAS_STATS.cellTypes.toLocaleString()} />
            <HeroMetric label="Samples" value={ATLAS_STATS.samples.toLocaleString()} />
          </div>
        </div>
      </section>

      <section className="rounded border border-line bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div>
            <h2 className="text-lg font-semibold">Dataset Downloads</h2>
            <p className="text-sm text-slate-500">Each dataset links to the corresponding file in Zenodo when available.</p>
          </div>
          <label className="flex items-center gap-2 rounded border border-line px-2">
            <Search size={15} className="text-slate-500" />
            <input className="h-8 w-64 max-sm:w-full outline-none" placeholder="Search GEO, origin, title" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-panel">
              <tr>
                {['Data', 'Title', 'GEO', 'Origin', 'Platform', 'Download'].map((header) => (
                  <th key={header} className="border-b border-line px-3 py-2 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDatasets.map((dataset) => (
                <tr key={dataset.id} className="odd:bg-white even:bg-panel/70">
                  <td className="border-b border-line px-3 py-2 font-semibold">{dataset.id}</td>
                  <td className="min-w-[420px] border-b border-line px-3 py-2">{dataset.title}</td>
                  <td className="border-b border-line px-3 py-2">{dataset.geo}</td>
                  <td className="border-b border-line px-3 py-2">{dataset.origin}</td>
                  <td className="border-b border-line px-3 py-2">{dataset.platform}</td>
                  <td className="border-b border-line px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {dataset.downloads.map((download) => (
                        <a key={download.label} className="button h-8 px-2" href={download.url} target="_blank" rel="noreferrer">
                          <Download size={14} />
                          {download.label}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white/85 p-4 shadow-soft">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function NavButton({ label, icon: Icon, onClick }: { label: string; icon: typeof CircleDot; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-20 touch-manipulation flex-col items-center justify-center gap-2 rounded border border-line bg-white/90 px-3 text-sm font-semibold text-ink shadow-soft transition hover:border-teal hover:text-teal"
      onClick={onClick}
    >
      <Icon size={22} />
      {label}
    </button>
  );
}
