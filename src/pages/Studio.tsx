import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Radar, FileSearch, PenTool, LayoutDashboard, Gauge, BrainCircuit, RefreshCw, ShieldCheck, BookOpen } from 'lucide-react';
import Logo from '../components/layout/Logo';
import Ambient from '../components/layout/Ambient';
import { generatePresentation, getProject, updateProject } from '../services';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { hostOf } from '../lib/format';
import type { DeckTheme, Project, PresentationPurpose, Slide, AnyUnderstanding } from '../types';

const PURPOSE_LABELS: Record<PresentationPurpose, string> = {
  // Legacy
  college: 'College project',
  investor: 'Investor briefing',
  client: 'Client presentation',
  'product-demo': 'Product demo',
  portfolio: 'Portfolio review',
  general: 'Presentation',
  // Research platform
  company_overview: 'Company Overview',
  investor_research: 'Investor Research',
  competitor_analysis: 'Competitor Analysis',
  product_research: 'Product Research',
  sales_presentation: 'Sales Presentation',
  market_research: 'Market Research',
};
import CrawlStage from '../studio/CrawlStage';
import DnaView from '../studio/DnaView';
import AnalysisView from '../studio/AnalysisView';
import AuditView from '../studio/AuditView';
import UnderstandView from '../studio/UnderstandView';
import ResearchView from '../studio/ResearchView';
import EditorStage from '../studio/EditorStage';
import { Spinner } from '../components/ui';

export type StudioStage = 'crawl' | 'report' | 'editor';
type ReportTab = 'research' | 'dna' | 'overview' | 'audit' | 'understanding';

/**
 * /project/:id[/audit|/presentation] — the project workspace.
 * Owns pipeline state: crawl → report (dna / analysis / audit / understanding) → editor.
 */
export default function Studio() {
  const { id = '', view } = useParams();
  const { project, slides, loading, error, setProject, setSlides } = useProjectDetail(id);
  const [regenerating, setRegenerating] = useState(false);
  const [stageOverride, setStageOverride] = useState<StudioStage | null>(null);
  const [tabOverride, setTabOverride] = useState<ReportTab | null>(null);
  const [genError, setGenError] = useState('');

  // stage is derived from pipeline status + optional view param until the user navigates
  const researchStatuses = ['identifying', 'researching', 'extracting', 'validating', 'planning'];
  const stage: StudioStage =
    stageOverride ??
    (view === 'audit' && project?.analysis
      ? 'report'
      : view === 'presentation' && project?.status === 'generated'
        ? 'editor'
        : project?.status === 'generated'
          ? 'editor'
          : project?.status === 'completed' || project?.status === 'analyzed'
            ? 'report'
            : researchStatuses.includes(project?.status || '')
              ? 'crawl'
              : 'crawl');
  const tab: ReportTab = tabOverride ?? (view === 'audit' ? 'audit' : 'research');
  const setStage = (s: StudioStage) => setStageOverride(s);
  const setTab = (t: ReportTab) => setTabOverride(t);

  const onAnalyzed = useCallback((p: Project) => {
    setProject(p);
    setStageOverride('report');
    setTabOverride('research'); // default to Research tab after analysis
  }, [setProject]);

  const onGenerated = useCallback(
    (nextSlides: Slide[], p?: Project) => {
      setSlides(nextSlides);
      if (p) setProject(p);
      else if (project) setProject({ ...project, status: 'generated' });
      setStageOverride('editor');
    },
    [setProject, setSlides, project]
  );

  const generate = async () => {
    if (!project || regenerating) return;
    setRegenerating(true);
    setGenError('');
    try {
      const fresh = await getProject(project.id);
      // Analysis is required; understanding is optional (crawl-only mode may not have it)
      if (!fresh.analysis) throw new Error('Research data is not available. Please run the research pipeline first.');
      const { slides: newSlides } = await generatePresentation(project.id);
      if (!newSlides || newSlides.length === 0) throw new Error('The generator returned no sections.');
      onGenerated(newSlides, fresh);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Presentation generation failed.';
      const ref = (e as { requestId?: string }).requestId;
      setGenError(`${message}${ref ? ` · ref ${ref}` : ''}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <Ambient />
        <div className="glass rounded-2xl p-10 text-center max-w-sm bg-white">
          <p className="font-display font-semibold text-lg">Study not found</p>
          <p className="text-fog text-sm mt-2">{error}</p>
          <Link to="/dashboard" className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 mt-6">
            <LayoutDashboard size={14} /> All projects
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <Ambient />
        <div className="flex items-center gap-3 text-fog">
          <Spinner size={18} /> Loading studio…
        </div>
      </div>
    );
  }

  const themePatch = (t: DeckTheme) => setProject({ ...project, theme: t });
  const understandingPatch = (u: AnyUnderstanding) => setProject({ ...project, understanding: u });

  const steps = [
    { key: 'crawl' as StudioStage, label: 'Research', icon: Radar, reachable: true },
    { key: 'report' as StudioStage, label: 'Research report', icon: FileSearch, reachable: !!project.analysis },
    { key: 'editor' as StudioStage, label: 'Deck studio', icon: PenTool, reachable: slides.length > 0 },
  ];

  return (
    <div className="min-h-screen relative flex flex-col">
      <Ambient intensity={stage === 'editor' ? 0.35 : 0.9} />

      {/* top bar */}
      <header className="sticky top-0 z-40 glass-deep border-b border-line">
        <div className="px-5 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="text-fog hover:text-ink transition-colors flex items-center gap-1.5 text-[13px] shrink-0">
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Projects</span>
          </Link>
          <div className="h-5 w-px bg-black/10" />
          <Logo size={26} withWord={false} />
          <div className="min-w-0">
            <p className="font-display font-semibold text-[14px] truncate leading-tight">{project.name}</p>
            <p className="text-[11px] font-mono text-fog truncate leading-tight">{hostOf(project.url)}</p>
          </div>
          {project.intake?.purpose && project.intake.purpose !== 'general' && (
            <span className="chip-lime rounded-full px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] hidden lg:inline-flex">
              {PURPOSE_LABELS[project.intake.purpose]}
            </span>
          )}

          {/* stepper */}
          <nav className="ml-auto flex items-center gap-1" aria-label="Pipeline stages">
            {steps.map((s, i) => {
              const active = stage === s.key;
              const done = (s.key === 'crawl' && !!project.analysis) || (s.key === 'report' && slides.length > 0);
              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && <div className="w-5 sm:w-8 h-px bg-black/15 mx-1" />}
                  <button
                    disabled={!s.reachable}
                    onClick={() => setStage(s.key)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all ${
                      active
                        ? 'chip-lime'
                        : done
                          ? 'text-fog hover:text-ink border border-transparent'
                          : 'text-fog/40 border border-transparent cursor-not-allowed'
                    }`}
                  >
                    <s.icon size={13} />
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
        {/* pipeline progress hairline */}
        <div className="h-[2px] bg-black/[0.06]">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: stage === 'crawl' ? '28%' : stage === 'report' ? '62%' : '100%',
              background: 'linear-gradient(90deg,#9db494,#d9f26b)',
            }}
          />
        </div>
      </header>

      {/* stages */}
      {stage === 'crawl' && <CrawlStage key={project.id + project.status} project={project} onAnalyzed={onAnalyzed} />}

      {stage === 'report' && project.analysis && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {(
              [
                { key: 'research', label: 'Research', icon: BookOpen },
                { key: 'dna', label: 'Vistara DNA', icon: ShieldCheck },
                { key: 'overview', label: 'Site analysis', icon: FileSearch },
                { key: 'audit', label: 'Audit', icon: Gauge },
                { key: 'understanding', label: 'Brief & Strategy', icon: BrainCircuit },
              ] as { key: ReportTab; label: string; icon: React.ElementType }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all ${
                  tab === t.key ? 'glass text-ink border-lime-deep/40 bg-lime-soft' : 'text-fog hover:text-ink border border-transparent'
                }`}
              >
                <t.icon size={14} className={tab === t.key ? 'text-lime-deep' : ''} />
                {t.label}
              </button>
            ))}
            <div className="flex items-center gap-2 lg:ml-auto max-lg:w-full max-lg:justify-end flex-wrap max-lg:mt-1">
              <button onClick={() => setStage('crawl')} className="btn-quiet whitespace-nowrap flex items-center gap-2 text-[12.5px] rounded-xl px-4 py-2.5">
                <RefreshCw size={13} /> Re-analyze
              </button>
              <button
                onClick={generate}
                disabled={regenerating}
                className="btn-grad whitespace-nowrap rounded-xl px-5 py-2.5 text-[13px] font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {regenerating ? <Spinner size={14} /> : <PenTool size={14} />}
                <span>{regenerating ? 'Generating…' : 'Generate presentation'}</span>
              </button>
            </div>
          </div>

          {/* generation failure banner — stays on the report, offers retry */}
          {genError && (
            <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl bg-[#f9e3e0] border border-[#ecc5c0] px-5 py-4">
              <span className="w-8 h-8 rounded-lg bg-[#f1c9c4] flex items-center justify-center shrink-0 text-[#a2403a] font-display font-bold">!</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#a2403a]">Presentation generation failed.</p>
                <p className="text-[12px] text-[#8a4039] mt-0.5 leading-snug">{genError}</p>
              </div>
              <button onClick={generate} disabled={regenerating} className="btn-grad rounded-xl px-4 py-2 text-[12.5px] font-semibold shrink-0 disabled:opacity-60">
                Try Again
              </button>
            </div>
          )}

          {tab === 'research' && (
            <ResearchView projectId={project.id} />
          )}
          {tab === 'dna' && (
            <DnaView
              project={project}
              onUseAccent={async (hex: string) => {
                const theme = { ...(project.theme || {}), accent: hex } as DeckTheme;
                themePatch(theme);
                await updateProject(project.id, { theme });
              }}
            />
          )}
          {tab === 'overview' && (
            <AnalysisView
              project={project}
              onUseAccent={async (hex: string) => {
                const theme = { ...(project.theme || {}), accent: hex } as DeckTheme;
                themePatch(theme);
                await updateProject(project.id, { theme });
              }}
            />
          )}
          {tab === 'audit' && project.audit && <AuditView audit={project.audit} />}
          {tab === 'understanding' && project.understanding && (
            <UnderstandView project={project} onSaved={understandingPatch} />
          )}
        </main>
      )}

      {stage === 'editor' && slides.length > 0 && (
        <EditorStage
          project={project}
          slides={slides}
          onSlidesChange={setSlides}
          onProjectChange={(p) => setProject(p)}
          onBackToReport={() => setStage('report')}
        />
      )}
    </div>
  );
}
