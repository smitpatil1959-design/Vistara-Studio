import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Globe, Loader2, Pencil, Play, TriangleAlert, Wifi } from 'lucide-react';
import { analyzeProject, getProject, updateProject, getResearchStatus, ApiError } from '../services';
import type { Project } from '../types';

const POLL_MS = 2200;

/** Polls until the (already running) research pipeline completes or fails. */
async function waitForResearch(projectId: string): Promise<Project> {
  const deadline = Date.now() + 360_000;
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const p = await getProject(projectId);
    if (['completed', 'generated', 'analyzed'].includes(p.status)) return p;
    if (p.status === 'failed' || p.status === 'error') {
      const crawlErr = p.analysis?.crawlError;
      const msg = crawlErr?.message || 'Research could not complete for this URL. Check the address and retry below.';
      throw new Error(msg);
    }
    if (Date.now() > deadline) throw new Error('Research is taking longer than usual — refresh in a moment.');
  }
}

interface Line {
  text: string;
  state: 'run' | 'done' | 'info' | 'warn';
}

const SCRIPT: string[] = [
  'Identifying website and organization subject',
  'Crawling official website pages',
  'Researching public internet sources',
  'Collecting evidence from sources',
  'Validating and scoring claims',
  'Resolving source conflicts',
  'Planning presentation structure',
  'Generating evidence-grounded slides',
];



export default function CrawlStage({ project, onAnalyzed }: { project: Project; onAnalyzed: (p: Project) => void }) {
  const [running, setRunning] = useState(['queued', 'draft', 'crawling', 'processing', 'analyzing', 'identifying', 'researching', 'extracting', 'validating', 'planning', 'generating'].includes(project.status));
  const [lines, setLines] = useState<Line[]>([]);
  const initialErr = project.analysis?.crawlError?.message || (project.status === 'failed' || project.status === 'error' ? 'The previous research attempt failed — retry below.' : '');
  const [err, setErr] = useState(initialErr);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(project.url);
  const [researchMode, setResearchMode] = useState<'crawl_only' | 'crawl_and_search' | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const started = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (started.current) return;
    if (['crawling', 'processing', 'analyzing', 'identifying', 'researching', 'extracting', 'validating', 'planning', 'generating'].includes(project.status)) {
      started.current = true;
      void pushLines(() => waitForResearch(project.id));
    } else if (['queued', 'draft'].includes(project.status)) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushLines = async (finisher: () => Promise<Project>) => {
    timers.current.forEach(clearTimeout);
    setLines([]);
    startedAtRef.current = Date.now();
    SCRIPT.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setLines((prev) => {
            const next = prev.map((l) => (l.state === 'run' ? { ...l, state: 'done' as const } : l));
            return [...next, { text: s, state: 'run' }];
          });
        }, 520 * i + 200)
      );
    });
    let updated: Project;
    try {
      try {
        updated = await finisher();
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          updated = await waitForResearch(project.id);
        } else throw e;
      }

      // Try to get real research session data
      let sessionData: { sourcesCount?: number; evidenceCount?: number; claimsCount?: number; conflictsCount?: number; researchMode?: string } = {};
      try {
        const session = await getResearchStatus(project.id);
        sessionData = session;
        if (session.researchMode) setResearchMode(session.researchMode as 'crawl_only' | 'crawl_and_search');
      } catch { /* non-fatal */ }

      const finishAt = Math.max(0, 520 * SCRIPT.length + 350 - (Date.now() - startedAtRef.current));
      timers.current.push(
        setTimeout(() => {
          const research = updated.analysis?.research;
          const isPartial = (research as { status?: string } | null | undefined)?.status === 'partial' || updated.analysis?.crawlStatus === 'partial';
          const mode = sessionData.researchMode || (research as { mode?: string } | null | undefined)?.mode || 'crawl_only';
          const summary = (research as { summary?: { totalSources?: number; totalEvidence?: number; totalClaims?: number; totalConflicts?: number } } | null | undefined)?.summary;
          const sourcesCount = sessionData.sourcesCount ?? summary?.totalSources ?? 0;
          const evidenceCount = sessionData.evidenceCount ?? summary?.totalEvidence ?? 0;
          const claimsCount = sessionData.claimsCount ?? summary?.totalClaims ?? 0;
          const conflictsCount = sessionData.conflictsCount ?? summary?.totalConflicts ?? 0;
          const subjectName = (sessionData as { subjectName?: string }).subjectName || (research as { subject?: { name?: string } } | null | undefined)?.subject?.name;
          const orgType = (research as { subject?: { orgType?: string } } | null | undefined)?.subject?.orgType || '';

          setLines((prev) => [
            ...prev.map((l) => (l.state === 'run' ? { ...l, state: 'done' as const } : l)),
            ...(mode === 'crawl_and_search'
              ? [
                  { text: `${sourcesCount} sources collected · ${evidenceCount} evidence points extracted`, state: 'info' as const },
                  { text: `${claimsCount} claims validated${conflictsCount > 0 ? ` · ${conflictsCount} conflicts resolved` : ''}`, state: 'info' as const },
                ]
              : [{ text: `${updated.analysis?.pages?.length ?? 0} pages mapped · ${claimsCount > 0 ? `${claimsCount} claims validated` : 'evidence extracted'}`, state: 'info' as const }]),
            ...(subjectName ? [{ text: `Subject identified: ${subjectName}${orgType ? ` (${orgType.replace(/_/g, ' ')})` : ''}`, state: 'info' as const }] : []),
            ...(isPartial ? [{ text: 'Note: Limited source access; available evidence used for presentation.', state: 'warn' as const }] : []),
          ]);
        }, finishAt)
      );
      timers.current.push(setTimeout(() => onAnalyzed(updated), finishAt + 1400));
    } catch (e: unknown) {
      timers.current.push(
        setTimeout(() => {
          setRunning(false);
          setErr(e instanceof Error ? e.message : 'Research failed.');
        }, 1400)
      );
    }
  };

  const run = async () => {
    if (started.current && running) return;
    started.current = true;
    setRunning(true);
    setErr('');
    await pushLines(async () => analyzeProject(project.id));
  };

  const saveUrlAndRun = async () => {
    setEditing(false);
    started.current = false;
    const p = await updateProject(project.id, { url });
    project.url = p.url;
    setRunning(true);
    started.current = true;
    await pushLines(async () => analyzeProject(project.id));
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-2xl relative">
        {/* lime halo */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[300px] -z-10 pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.55), transparent 80%)', filter: 'blur(48px)' }}
        />
        <p className="inline-flex items-center gap-2 chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] mx-auto w-fit mb-4 relative left-1/2 -translate-x-1/2">
          Stage 01 — Research
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-center leading-[1.04]">
          Researching <span className="text-grad">{project.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        </h1>
        <p className="text-fog text-center mt-4 text-[15px] max-w-lg mx-auto">
          The studio identifies the subject, crawls the website, and researches authoritative public sources to build an evidence-grounded presentation.
        </p>

        {/* Research mode indicator */}
        {researchMode === 'crawl_and_search' && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-mono text-sage-deep">
            <Wifi size={12} /> Internet research enabled
          </div>
        )}

        <div className="glass rounded-2xl p-2 mt-6 flex items-center gap-2 bg-white">
          <Globe size={15} className="ml-3 text-fog shrink-0" />
          {editing ? (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm py-2.5 min-w-0"
              onKeyDown={(e) => e.key === 'Enter' && saveUrlAndRun()}
              autoFocus
            />
          ) : (
            <span className="flex-1 text-sm font-mono text-ink/80 truncate py-2.5">{url}</span>
          )}
          {!running && !editing && (
            <button onClick={() => setEditing(true)} className="p-2.5 rounded-lg text-fog hover:text-ink hover:bg-black/[0.05] transition-colors">
              <Pencil size={14} />
            </button>
          )}
          {editing ? (
            <button onClick={saveUrlAndRun} className="btn-grad rounded-xl px-4 py-2.5 text-[13px] font-semibold">
              Save &amp; run
            </button>
          ) : !running ? (
            <button onClick={run} disabled={running} className="btn-grad rounded-xl px-5 py-2.5 text-[13px] font-semibold flex items-center gap-2 disabled:opacity-60">
              <Play size={14} /> Begin Research
            </button>
          ) : (
            <span className="px-4 py-2.5 text-[13px] text-lime-deep flex items-center gap-2 font-medium">
              <Loader2 size={14} className="animate-spin" /> Researching
            </span>
          )}
        </div>

        {/* engine log */}
        <div className="glass-deep rounded-2xl mt-6 overflow-hidden bg-white">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line bg-panel2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[10px] font-mono uppercase tracking-[0.22em] text-fog">vistara research engine</span>
            {running && <span className="ml-auto chip-lime rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold">LIVE</span>}
          </div>
          <div className="p-5 min-h-[240px] font-mono text-[12.5px] leading-[2]">
            {lines.length === 0 && <p className="text-fog/60">Idle — press Begin Research to start the research engine.</p>}
            {lines.map((l, i) => (
              <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
                {l.state === 'run' && <Loader2 size={12} className="animate-spin text-lime-deep shrink-0" />}
                {l.state === 'done' && <Check size={12} className="text-sage-deep shrink-0" />}
                {l.state === 'info' && <span className="w-3 text-lime-deep shrink-0">›</span>}
                {l.state === 'warn' && <span className="w-3 text-amber-500 shrink-0">⚠</span>}
                <span className={
                  l.state === 'info' ? 'text-sage-deep' :
                  l.state === 'warn' ? 'text-amber-600' :
                  l.state === 'run' ? 'text-ink' :
                  'text-fog'
                }>{l.text}</span>
              </motion.p>
            ))}
            {err && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-start gap-2.5 text-[#a2403a]">
                <TriangleAlert size={14} className="mt-1 shrink-0" />
                <div>
                  <p>{err}</p>
                  <button onClick={() => { started.current = false; run(); }} className="mt-2 text-[12px] underline underline-offset-4 hover:text-ink">
                    Retry research
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
