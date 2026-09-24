import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown, ArrowUpRight, Clock, FolderOpen, Loader2, Plus, Radar, Search, SearchX, Settings2, Sparkles, Trash2, TriangleAlert,
} from 'lucide-react';
import Ambient from '../components/layout/Ambient';
import TopNav from '../components/layout/TopNav';
import UrlStudyForm from '../components/UrlStudyForm';
import { EmptyState, Pill } from '../components/ui';
import { hostOf, timeAgo } from '../lib/format';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import type { Project, ProjectStatus } from '../types';

/* ------------------------------------------------ status taxonomy */

type PillTone = 'default' | 'accent' | 'success' | 'warn' | 'fail';

/** The full research + deck lifecycle surfaced to users. */
const STATUS_META: Record<ProjectStatus, { label: string; tone: PillTone; pulse?: boolean }> = {
  queued: { label: 'Queued', tone: 'default' },
  crawling: { label: 'Crawling', tone: 'accent', pulse: true },
  processing: { label: 'Processing', tone: 'accent', pulse: true },
  completed: { label: 'Research Complete', tone: 'default' },
  generating: { label: 'Generating', tone: 'accent', pulse: true },
  generated: { label: 'Ready', tone: 'success' },
  planning: { label: 'Planning', tone: 'accent', pulse: true },
  failed: { label: 'Failed', tone: 'fail' },
  // Research pipeline steps
  identifying: { label: 'Identifying', tone: 'accent', pulse: true },
  researching: { label: 'Researching', tone: 'accent', pulse: true },
  extracting: { label: 'Extracting', tone: 'accent', pulse: true },
  validating: { label: 'Validating', tone: 'accent', pulse: true },
  // legacy aliases (pre-lifecycle rows)
  draft: { label: 'Queued', tone: 'default' },
  analyzing: { label: 'Crawling', tone: 'accent', pulse: true },
  analyzed: { label: 'Research Complete', tone: 'default' },
  error: { label: 'Failed', tone: 'fail' },
};

const STATUS_ORDER: ProjectStatus[] = ['generated', 'completed', 'analyzed', 'generating', 'processing', 'crawling', 'analyzing', 'queued', 'draft', 'failed', 'error'];
const STATUS_RANK: Record<ProjectStatus, number> = Object.fromEntries(STATUS_ORDER.map((s, i) => [s, i])) as Record<ProjectStatus, number>;

function presentationStatus(p: Project): { label: string; tone: PillTone } {
  return p.status === 'generated' ? { label: 'Deck ready', tone: 'accent' } : { label: 'No deck yet', tone: 'default' };
}

/* ------------------------------------------------ query model */

type SortKey = 'recent' | 'health' | 'name' | 'status';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: 'Last updated' },
  { id: 'health', label: 'Health score' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'status', label: 'Status' },
];

function applyQuery(
  projects: Project[] | null | undefined,
  lastActivity: Record<string, string>,
  q: string,
  sort: SortKey,
  statusFilter: ProjectStatus | 'all'
): Project[] {
  let rows = Array.isArray(projects) ? projects : [];

  if (statusFilter !== 'all') {
    rows = rows.filter((p) => p.status === statusFilter);
  }

  const query = q.trim().toLowerCase();

  if (query) {
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        hostOf(p.url).toLowerCase().includes(query)
    );
  }

  const byRecent = (p: Project) =>
    lastActivity[p.id] ?? p.created_at;

  rows = [...rows].sort((a, b) => {
    if (sort === 'health') {
      return (b.audit?.overall ?? -1) - (a.audit?.overall ?? -1);
    }

    if (sort === 'name') {
      return a.name.localeCompare(b.name);
    }

    if (sort === 'status') {
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    }

    return byRecent(b).localeCompare(byRecent(a));
  });

  return rows;
}

/* ------------------------------------------------ page */

export default function Dashboard() {
  const { projects, lastActivity, loading, error, refresh, remove } = useProjects();
  const { user } = useAuth();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const onRemove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId(null), 2600);
      return;
    }
    await remove(id);
    setConfirmId(null);
  };

  const visible = useMemo(
    () => applyQuery(projects, lastActivity, query, sort, statusFilter),
    [projects, lastActivity, query, sort, statusFilter]
  );

  const audited = projects.filter((p) => p.audit);
  const avgHealth = audited.length ? Math.round(audited.reduce((s, p) => s + (p.audit?.overall || 0), 0) / audited.length) : null;
  const readyDecks = projects.filter((p) => p.status === 'generated').length;
  const presentStatuses = [...new Set(projects.map((p) => p.status))].sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b]);

  return (
    <div className="min-h-screen relative">
      <Ambient />
      <TopNav
        label="Studio workspace"
        right={
          <>
            <Link to="/settings" className="btn-quiet rounded-full px-3.5 py-2 text-[12.5px] flex items-center gap-1.5">
              <Settings2 size={13} /> <span className="hidden sm:inline">Settings</span>
            </Link>
            <Link to="/create" className="btn-grad rounded-xl px-4 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5">
              <Plus size={14} /> New study
            </Link>
          </>
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ------------------------------- welcome area */}
        <section className="relative overflow-hidden rounded-3xl chip-lime p-8 md:p-10 noise mb-8">
          <div
            className="absolute -top-20 -right-16 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.5), transparent)', filter: 'blur(30px)' }}
          />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block opacity-[0.16]" aria-hidden>
            <svg width="150" height="150" viewBox="0 0 64 64">
              <path d="M32 4 Q35.6 25.4 58 32 Q35.6 38.6 32 60 Q28.4 38.6 6 32 Q28.4 25.4 32 4 Z" fill="#17170F" />
            </svg>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-[0.26em] text-lime-deep/80">{user?.email ?? 'Workspace'}</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.03em] mt-3 max-w-xl leading-[1.04]">
            Welcome back. Which website are we presenting today?
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-5 text-[12px] font-mono">
            <span className="bg-white/70 hairline rounded-full px-3.5 py-1.5">{projects.length} studies</span>
            <span className="bg-white/70 hairline rounded-full px-3.5 py-1.5">{readyDecks} decks ready</span>
            <span className="bg-white/70 hairline rounded-full px-3.5 py-1.5">{avgHealth !== null ? `avg health ${avgHealth}` : 'no audits yet'}</span>
          </div>
          <div className="w-full md:w-[480px] mt-7">
            <UrlStudyForm compact />
          </div>
        </section>

        {/* ------------------------------- toolbar */}
        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 mb-6">
            <div className="input-ghost rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 flex-1 min-w-[220px] max-w-sm">
              <Search size={14} className="text-fog shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or URL…"
                aria-label="Search projects"
                className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
              />
            </div>

            <div className="relative">
              <ArrowUpDown size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fog pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort projects"
                className="input-ghost rounded-xl pl-9 pr-8 py-2.5 text-[13px] appearance-none cursor-pointer bg-white"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5 ml-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-all ${statusFilter === 'all' ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}
              >
                All · {projects.length}
              </button>
              {presentStatuses.map((s) => {
                const meta = STATUS_META[s];
                const count = projects.filter((p) => p.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                    className={`rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-all flex items-center gap-1.5 ${statusFilter === s ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}
                  >
                    {meta.pulse && <Loader2 size={10} className="animate-spin" />}
                    {meta.label} · {count}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------- body states */}
        {loading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="glass rounded-3xl bg-white p-10 text-center">
            <span className="w-12 h-12 rounded-2xl bg-[#f9e3e0] border border-[#ecc5c0] flex items-center justify-center text-[#a2403a] mx-auto mb-4">
              <TriangleAlert size={20} />
            </span>
            <h3 className="font-display font-semibold text-lg">Could not load your studies</h3>
            <p className="text-fog text-sm mt-2 max-w-sm mx-auto leading-relaxed">{error}</p>
            <button onClick={refresh} className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold mt-6">
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass rounded-3xl bg-white">
            <EmptyState
              icon={<FolderOpen size={22} />}
              title="No studies yet"
              sub="Paste a website URL above — Vistara crawls it, audits it, understands it, and composes the presentation."
            />
            <div className="pb-10 flex justify-center">
              <Link to="/create" className="btn-grad rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2">
                <Plus size={14} /> Create your first study
              </Link>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="glass rounded-3xl bg-white">
            <EmptyState
              icon={<SearchX size={22} />}
              title={query ? `No studies match “${query}”` : 'Nothing in this state'}
              sub="Try a different search term or clear the status filter."
            />
            <div className="pb-10 flex justify-center">
              <button
                onClick={() => { setQuery(''); setStatusFilter('all'); }}
                className="btn-quiet rounded-xl px-5 py-2.5 text-sm font-medium"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                lastActivity={lastActivity[p.id] ?? p.created_at}
                confirming={confirmId === p.id}
                onRemove={() => onRemove(p.id)}
              />
            ))}
            <Link
              to="/create"
              className="rounded-2xl border border-dashed border-black/20 flex flex-col items-center justify-center gap-3 py-14 text-fog hover:text-ink hover:border-lime-deep/50 hover:bg-lime-soft/40 transition-all group"
            >
              <span className="w-11 h-11 rounded-xl bg-lime-soft hairline flex items-center justify-center group-hover:scale-110 transition-transform text-lime-deep">
                <Radar size={17} />
              </span>
              <span className="text-sm">Study another website</span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------ card */

function ProjectCard({
  project: p,
  lastActivity,
  confirming,
  onRemove,
}: {
  project: Project;
  lastActivity: string;
  confirming: boolean;
  onRemove: () => void;
}) {
  const status = STATUS_META[p.status];
  const deck = presentationStatus(p);
  const shot = p.analysis?.screenshot;
  const health = p.audit?.overall ?? null;

  return (
    <article className="glass rounded-2xl overflow-hidden card-hover group relative bg-white flex flex-col">
      <Link to={`/project/${p.id}`} className="block">
        <div className="aspect-[16/8] relative overflow-hidden bg-panel2 border-b border-line grid-paper">
          {shot && (
            <img
              src={shot}
              alt={`Screenshot of ${hostOf(p.url)}`}
              className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
          {!shot && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display font-semibold text-3xl text-black/[0.08]">{p.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Pill tone={status.tone}>
              {status.pulse && <Loader2 size={10} className="animate-spin" />}
              {status.label}
            </Pill>
          </div>
          {health !== null && (
            <div className="absolute top-3 right-3 glass-deep rounded-full px-2.5 py-1.5 flex items-center gap-2">
              <span className="h-1.5 w-9 rounded-full bg-black/[0.08] overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${health}%`, background: 'linear-gradient(90deg,#9db494,#6f9463)' }} />
              </span>
              <span className="text-[11px] font-mono font-semibold text-sage-deep">{health}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <Link to={`/project/${p.id}`} className="flex items-center justify-between gap-3">
          <h3 className="font-display font-semibold truncate text-[16px]">{p.name}</h3>
          <ArrowUpRight size={16} className="text-fog group-hover:text-lime-deep group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </Link>
        <p className="text-fog text-xs font-mono mt-1 truncate">{hostOf(p.url)}</p>

        <div className="flex items-center gap-2 mt-4">
          <Pill tone={deck.tone}>
            {p.status === 'generated' && <Sparkles size={10} />}
            {deck.label}
          </Pill>
          <span className="text-[11px] text-fog/80 flex items-center gap-1.5 ml-auto" title={`Last updated ${new Date(lastActivity).toLocaleString()}`}>
            <Clock size={11} /> {timeAgo(lastActivity)}
          </span>
        </div>
      </div>

      <button
        onClick={onRemove}
        className={`absolute bottom-4 right-4 p-2 rounded-lg transition-all text-xs flex items-center gap-1.5 ${confirming
            ? 'bg-[#f9e3e0] text-[#a2403a] border border-[#ecc5c0] px-3'
            : 'text-fog/0 group-hover:text-fog hover:text-[#a2403a] hover:bg-[#f9e3e0]'
          }`}
        aria-label={confirming ? 'Confirm delete' : `Delete ${p.name}`}
      >
        <Trash2 size={13} />
        {confirming && 'Confirm delete'}
      </button>
    </article>
  );
}

/* ------------------------------------------------ skeleton */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading projects">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden bg-white">
          <div className="aspect-[16/8] shimmer-line" />
          <div className="p-5">
            <div className="h-4 w-2/3 rounded shimmer-line" />
            <div className="h-3 w-1/3 rounded shimmer-line mt-3" />
            <div className="h-6 w-1/2 rounded-full shimmer-line mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
