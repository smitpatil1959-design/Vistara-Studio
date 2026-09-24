import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, Check, Download, FileJson, FileText, Loader2, Redo2, Send, Share2, Sparkles, Undo2, Play, AlertTriangle, X,
} from 'lucide-react';
import { getSpec, getSlides, putSpec, sendAiCommand, getVisibility as fetchVisibility, setDeckVisibility } from '../services';
import { useChat } from '../hooks/useChat';
import { useToast } from '../hooks/useToast';
import { useUndoable } from '../hooks/useUndoable';
import * as ops from '../deck-spec/ops';
import type { PresentationSpec } from '../deck-spec';
import { buildSpecFromSlides } from '../deck-spec';
import type { Project, Slide } from '../types';
import InteractiveCanvas from './InteractiveCanvas';
import SlideRail from './SlideRail';
import InspectorPanel from './InspectorPanel';
import ExportDialog from './ExportDialog';
import CreativeDirector from './CreativeDirector';
import type { DirectorPlanItem } from './CreativeDirector';
import { Pill } from '../components/ui';

const QUICK_PROMPTS = [
  'Make it more premium — emerald palette, serif headlines',
  'Shorten every section to the essentials',
  'Add a pricing section before the call to action',
  'Move technology before features',
  'Cinematic zoom entrances, please',
];

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Props {
  project: Project;
  slides: Slide[];
  onSlidesChange: (s: Slide[]) => void;
  onProjectChange: (p: Project) => void;
  onBackToReport: () => void;
}

/** The deck studio — every mutation writes the presentation.v1 specification. */
export default function EditorStage({ project, slides, onSlidesChange, onProjectChange, onBackToReport }: Props) {
  const nav = useNavigate();
  const { toast, show: showToast } = useToast();
  const { messages: msgs, push: pushMsg } = useChat(project.id);

  /* ------------------------------------------------ schema as source of truth */
  const [spec, setSpec] = useState<PresentationSpec | null>(null);
  const [specVersion, setSpecVersion] = useState<number>(0);
  const [specError, setSpecError] = useState('');
  const [specStamp, setSpecStamp] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const row = await getSpec(project.id);
        if (!alive) return;
        setSpec(row.spec);
        setSpecVersion(row.version);
        setSpecError('');
      } catch {
        if (!alive) return;
        if (slides.length) {
          setSpec(buildSpecFromSlides(project, slides, 'generated', project.intake?.purpose || 'general'));
        } else {
          setSpecError('Schema build pending — generate the deck first.');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  /* ------------------------------------------------ selection state */
  const [slideIdx, setSlideIdx] = useState(0);
  const [selElId, setSelElId] = useState<string | null>(null);

  /* ------------------------------------------------ undo/redo + autosave */
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastEdit, setLastEdit] = useState('initial');
  const history = useUndoable<PresentationSpec | null>(spec, (n) => setSpec(n), (d) => JSON.stringify(d), 64);
  const [, forceHistoryTick] = useState(0);
  const commit = useCallback(
    (next: PresentationSpec, label?: string) => {
      history.commit(next);
      forceHistoryTick((v) => v + 1);
      setLastEdit(label || 'edit');
      setSaveState('dirty');
    },
    [history]
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const persistRef = useRef<(doc: PresentationSpec) => Promise<void>>(async () => {});

  const persist = useCallback(
    async (doc: PresentationSpec) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaveState('saving');
      try {
        const res = await putSpec(project.id, doc);
        setSpecVersion(res.version ?? specVersion + 1);
        setSaveState('saved');
        setSpecStamp((v) => v + 1);
        // rows were re-projected server-side — keep the legacy surfaces quiet-fresh
        getSlides(project.id).then(onSlidesChange).catch((error) => {
          showToast(error instanceof Error ? error.message : 'Could not refresh slides after saving');
        });
      } catch (e) {
        setSaveState('error');
        showToast(e instanceof Error ? e.message : 'Autosave failed');
      } finally {
        inFlight.current = false;
      }
    },
    [project.id, onSlidesChange, specVersion, showToast]
  );

  useEffect(() => {
    if (saveState !== 'dirty' || !spec) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const t = setTimeout(() => void persistRef.current(spec), 850);
    saveTimer.current = t;
    return () => clearTimeout(t);
  }, [spec, saveState]);

  // always point at the latest persist — assigned from a passive effect only
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (spec) void persistRef.current(spec);
    setSaveState('saved');
  }, [spec]);

  /* ------------------------------------------------ chat / copilot (server-side AI edits) */
  const [cmd, setCmd] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [railTab, setRailTab] = useState<'inspector' | 'director'>('director');
  const [lastPlan, setLastPlan] = useState<DirectorPlanItem[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [animKey, setAnimKey] = useState(0);
  const [animating, setAnimating] = useState(false);


  useEffect(() => {
    let alive = true;
    fetchVisibility(project.id)
      .then((r) => { if (alive) setVisibility(r.visibility); })
      .catch(() => {});
    return () => { alive = false; };
  }, [project.id]);
  const [lastDropped, setLastDropped] = useState<{ op: string; reason: string; fields?: string[] }[]>([]);

  const runCommand = async (text: string) => {
    const c = text.trim();
    if (!c || aiBusy) return;
    setCmd('');
    setAiBusy(true);
    setRailTab('director');
    pushMsg('user', c);
    try {
      const res = await sendAiCommand(project.id, c);
      onSlidesChange(res.slides);
      setSlideIdx((i) => Math.min(i, Math.max(0, res.slides.length - 1)));
      setLastPlan(res.plan || []);
      setLastDropped(res.dropped || []);
      if (res.theme || res.understanding) onProjectChange({ ...project, theme: res.theme || project.theme, understanding: (res.understanding as never) || project.understanding });
      pushMsg('assistant', res.reply);
      if (res.changes?.length) showToast(res.changes[0]);
      // server already rebuilt the canonical schema — re-anchor local state to it
      const row = await getSpec(project.id);
      setSpec(row.spec);
      setSpecVersion(row.version);
      history.reset(row.spec);
      setSpecStamp((v) => v + 1);
    } catch (e) {
      pushMsg('assistant', `I hit a snag: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setAiBusy(false);
    }
  };

  /* ------------------------------------------------ selected element helpers */
  const slide = spec?.slides[slideIdx] || null;
  const selectedEl: import('../deck-spec').SlideElement | null = useMemo(() => {
    if (!slide || !selElId) return null;
    const walk = (els: import('../deck-spec').SlideElement[]): import('../deck-spec').SlideElement | null => {
      for (const e of els) {
        if (e.id === selElId) return e;
        if (e.content.kind === 'group') {
          const hit = walk(e.content.children);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(slide.elements);
  }, [slide, selElId]);

  /* ------------------------------------------------ keyboard map */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable="true"]')) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
        setSaveState('dirty');
        return;
      }
      if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        history.redo();
        setSaveState('dirty');
        return;
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSave();
        return;
      }
      if (!spec || !slide) return;
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selElId) {
          const r = ops.duplicateElement(spec, slide.id, selElId);
          if (r.newId) setSelElId(r.newId);
          commit(r.spec, 'Duplicate element');
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selElId) {
        commit(ops.deleteElement(spec, slide.id, selElId), 'Delete element');
        setSelElId(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !selElId) return;
      if (e.key === 'Escape') {
        setSelElId(null);
        return;
      }
      if (e.key === 'PageDown' && slideIdx < (spec.slides.length - 1)) {
        setSlideIdx(slideIdx + 1);
        setSelElId(null);
      }
      if (e.key === 'PageUp' && slideIdx > 0) {
        setSlideIdx(slideIdx - 1);
        setSelElId(null);
      }
      if (selElId && selectedEl && selectedEl.position.mode === 'absolute' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 8 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit(
          ops.moveElementTo(spec, slide.id, selElId, (selectedEl.position.x ?? 0) + dx, (selectedEl.position.y ?? 0) + dy),
          'Nudge element'
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, slide, selElId, slideIdx, selectedEl, history, flushSave, commit]);

  /* ------------------------------------------------ rail actions */

  if (specError && !spec) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl bg-white p-10 text-center max-w-sm">
          <AlertTriangle size={20} className="text-[#b08a1e] mx-auto mb-4" />
          <p className="font-display font-semibold">{specError}</p>
          <p className="text-fog text-sm mt-2">Go back to the report step and generate the deck first.</p>
          <button onClick={onBackToReport} className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold mt-6">
            Back to report
          </button>
        </div>
      </div>
    );
  }

  const directorContext = [
    project.analysis ? `${project.analysis.pages?.length ?? 0} pages crawled` : null,
    project.audit ? `health ${project.audit.overall}/100` : null,
    project.intake?.purpose && project.intake.purpose !== 'general' ? `purpose: ${project.intake.purpose}` : null,
    project.analysis?.captureMode === 'browser' ? 'rendered context' : null,
    `${spec?.slides.length ?? 0} sections`,
  ].filter(Boolean) as string[];

  if (!spec || !slide) {
    return (
      <div className="flex-1 flex items-center justify-center text-fog gap-3">
        <Loader2 size={18} className="animate-spin" /> Loading the schema…
      </div>
    );
  }

  const handlePreviewAnimation = () => {
    setAnimating(true);
    setAnimKey((k) => k + 1);
    setTimeout(() => setAnimating(false), 1400);
  };


  const handleAiRedesign = async () => {
    if (aiBusy) return;
    await runCommand('✦ AI Redesign: elevate visual identity, typography, layout, and polish the deck');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ height: 'calc(100vh - 57px)' }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-white/70 backdrop-blur flex-wrap">
        <button onClick={onBackToReport} className="btn-quiet text-[12.5px] flex items-center gap-1.5 rounded-lg px-3 py-2">
          <FileText size={13} /> Report
        </button>

        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => { history.undo(); setSaveState('dirty'); }}
            title="Undo (⌘Z)"
            className="p-2 rounded-lg text-fog hover:text-ink hover:bg-black/[0.04] disabled:opacity-30 transition-colors"
            disabled={!history.canUndo}
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={() => { history.redo(); setSaveState('dirty'); }}
            title="Redo (⌘⇧Z)"
            className="p-2 rounded-lg text-fog hover:text-ink hover:bg-black/[0.04] disabled:opacity-30 transition-colors"
            disabled={!history.canRedo}
          >
            <Redo2 size={15} />
          </button>
        </div>

        <Pill tone={saveState === 'error' ? 'fail' : 'success'}>
          {saveState === 'saving' && <Loader2 size={10} className="animate-spin" />}
          {saveState === 'dirty' && <span className="w-1.5 h-1.5 rounded-full bg-[#b08a1e]" />}
          {saveState === 'saved' && <Check size={10} />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? `Unsaved · ${lastEdit}` : saveState === 'error' ? 'Save failed' : `Saved · v${specVersion}`}
        </Pill>
        <span className="text-[11px] font-mono text-fog/70 hidden lg:inline">{spec.slides.length} slides · schema {spec.schemaVersion.replace('presentation.', 'v')}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePreviewAnimation}
            className="btn-quiet rounded-lg px-3 py-2 text-[12.5px] flex items-center gap-1.5 hover:bg-black/[0.04]"
            title="Preview slide animations"
          >
            <Play size={12} className={animating ? "text-lime-deep animate-spin" : "text-lime-deep"} />
            <span>Preview</span>
          </button>
          <button
            onClick={handleAiRedesign}
            disabled={aiBusy}
            className="btn-grad rounded-lg px-3.5 py-2 text-[12.5px] font-semibold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            title="AI Redesign: Analyze and elevate typography, brand palette, layout, and visual balance"
          >
            {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-300" />}
            <span>✦ AI Redesign</span>
          </button>
          <button onClick={() => setRailTab((t) => (t === 'director' ? 'inspector' : 'director'))} className={`btn-quiet rounded-lg px-3.5 py-2 text-[12.5px] flex items-center gap-1.5 ${railTab === 'director' ? 'border-lime-deep/50 bg-lime-soft' : ''}`}>
            <Bot size={13} /> AI Director
          </button>
          <button onClick={() => setShareOpen((v) => !v)} className={`btn-quiet rounded-lg px-3.5 py-2 text-[12.5px] flex items-center gap-1.5 ${shareOpen ? 'border-lime-deep/50 bg-lime-soft' : ''}`}>
            <Share2 size={13} /> Share
          </button>
          <ExportMenu onJson={() => exportJson()} project={project} onReady={() => setExportOpen(true)} />
          <button onClick={() => { flushSave(); nav(`/present/${project.id}`); }} className="btn-grad rounded-lg px-4 py-2 text-[12.5px] font-semibold flex items-center gap-1.5">
            <Play size={13} /> Present
          </button>
        </div>
      </div>



      <div className="flex-1 flex min-h-0">
        {/* LEFT — slide manager */}
        <SlideRail
          spec={spec}
          index={slideIdx}
          onSelect={(i) => { setSlideIdx(i); setSelElId(null); }}
          onMove={(id, dir) => {
            const i = spec.slides.findIndex((s) => s.id === id);
            const j = i + dir;
            if (j < 0 || j >= spec.slides.length) return;
            commit(ops.reorderSlides(spec, i, j), 'Reorder slides');
            setSlideIdx(j);
          }}
          onDuplicate={(id) => {
            const r = ops.duplicateSlide(spec, id);
            if (r.newId) {
              commit(r.spec, 'Duplicate slide');
              const i = r.spec.slides.findIndex((s) => s.id === r.newId);
              if (i !== -1) setSlideIdx(i);
            }
          }}
          onDelete={(id) => { commit(ops.deleteSlide(spec, id), 'Delete slide'); setSlideIdx((i) => Math.max(0, Math.min(i, spec.slides.length - 2))); }}
          onAdd={(section) => {
            const r = ops.addSlide(spec, section as never);
            commit(r.spec, 'Add slide');
            setSlideIdx(r.spec.slides.length - 1);
          }}
        />

        {/* CENTER — interactive canvas */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-5 md:p-8">
          <div className="w-full max-w-[980px] mx-auto">
            <div className="rounded-[18px] overflow-hidden shadow-[0_32px_80px_-32px_rgba(23,23,15,0.35)] ring-1 ring-black/10 bg-white">
              <InteractiveCanvas
                key={`${slide.id}-${animKey}`}
                spec={spec}
                slideIndex={slideIdx}
                selectedId={selElId}
                onSelect={setSelElId}
                onLiveEdit={(next) => setSpec(next)}
                onCommitChange={(next, label) => commit(next, label)}
                animate={animating}
              />

            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-[11px] font-mono text-fog">
                SLIDE {String(slideIdx + 1).padStart(2, '0')} / {String(spec.slides.length).padStart(2, '0')} · {slide.section.toUpperCase()} · {slide.elements.length} ELEMENTS
              </p>
              <p className="text-[11px] font-mono text-fog/60 hidden md:inline">click selects · drag moves · corner resizes · ⌫ deletes · ⌘Z undoes</p>
            </div>
          </div>

        </div>

        {/* RIGHT — Creative Director / Properties inspector */}
        <aside className="w-[330px] shrink-0 border-l border-line flex flex-col min-h-0 max-lg:hidden bg-white/70">
          <div className="flex border-b border-line shrink-0">
            {(
              [
                ['director', 'VISTARA AI'],
                ['inspector', 'Properties'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setRailTab(k)}
                className={`flex-1 py-3 text-[11.5px] font-medium tracking-wide transition-all border-b-2 ${railTab === k ? 'text-ink border-lime-deep bg-lime-soft/60' : 'text-fog border-transparent hover:text-ink'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {railTab === 'director' ? (
              <CreativeDirector
                project={project}
                messages={msgs}
                busy={aiBusy}
                onCommand={runCommand}
                onQuickStart={runCommand}
                context={directorContext}
                lastPlan={lastPlan}
                lastDropped={lastDropped}
                onUndo={() => { history.undo(); setSaveState('dirty'); }}
                canUndo={history.canUndo}
              />
            ) : (
              <InspectorPanel
                spec={spec}
                slide={slide}
                slideIndex={slideIdx}
                selected={selectedEl}
                onCanvasCommit={commit}
                ops={ops}
                projectId={project.id}
                specStamp={specStamp}
              />
            )}
          </div>
        </aside>
      </div>

      {/* BOTTOM — AI command bar */}
      <div className="shrink-0 px-5 pb-4 pt-1">
        <div className="glass-deep bg-white rounded-2xl p-1.5 flex items-center gap-2 max-w-[980px] mx-auto shadow-[0_18px_50px_-20px_rgba(23,23,15,0.4)]">
          <span className={`pl-3.5 flex items-center ${aiBusy ? 'text-sage-deep' : 'text-lime-deep'}`}>
            {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runCommand(cmd)}
            placeholder={aiBusy ? 'The AI is editing your deck…' : 'Direct the deck — “emerald palette”, “add a pricing section”, “formal tone”…'}
            className="flex-1 bg-transparent outline-none text-[14px] py-3 placeholder:text-fog/50 min-w-0"
          />
          <button onClick={() => runCommand(cmd)} disabled={aiBusy || !cmd.trim()} className="btn-grad rounded-xl px-4 py-3 disabled:opacity-40" title="Send (Enter)">
            <Send size={15} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap justify-center max-md:hidden">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} onClick={() => runCommand(q)} className="text-[10px] font-mono text-fog/80 hover:text-ink glass bg-white rounded-full px-3 py-1.5 transition-colors">
              {q}
            </button>
          ))}
        </div>
      </div>

      {shareOpen && (
        <ShareCard
          projectId={project.id}
          visibility={visibility}
          onVisibility={setVisibility}
          onClose={() => setShareOpen(false)}
          onToast={showToast}
        />
      )}

      {exportOpen && (
        <ExportDialog
          projectId={project.id}
          projectName={project.name}
          origin={window.location.origin}
          onClose={() => setExportOpen(false)}
          onOpenPrint={() => nav(`/present/${project.id}?print=1`)}
        />
      )}

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 glass-deep rounded-full px-5 py-2.5 text-[13px] flex items-center gap-2 z-50 bg-white">
            <Check size={13} className="text-sage-deep" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );



  function exportJson() {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-presentation.v1.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Spec exported — the canonical document');
  }
}

/* workspace share card — visibility is server-enforced, not cosmetic */
function ShareCard({
  projectId,
  visibility,
  onVisibility,
  onClose,
  onToast,
}: {
  projectId: string;
  visibility: 'public' | 'unlisted' | 'private';
  onVisibility: (v: 'public' | 'unlisted' | 'private') => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/p/${projectId}`;

  const MODE: { id: 'public' | 'unlisted' | 'private'; icon: React.ElementType; title: string; body: string }[] = [
    { id: 'public', icon: Eye1, title: 'Public', body: 'Listed in the showcase gallery; anyone can open the link.' },
    { id: 'unlisted', icon: Link22, title: 'Unlisted', body: 'Only people you share the link with can open it. Default.' },
    { id: 'private', icon: Lock2, title: 'Private', body: 'Signed-in workspace members only; the link returns a private screen.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="absolute top-12 right-4 z-40 w-[340px] glass-deep bg-white rounded-2xl p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-semibold text-[14px]">Share & visibility</p>
        <button onClick={onClose} className="p-1 rounded-md text-fog hover:text-ink">
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 mb-4">
        {MODE.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setDeckVisibility(projectId, m.id);
                onVisibility(m.id);
                onToast(`Visibility set to ${m.title}`);
              } finally {
                setBusy(false);
              }
            }}
            className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all ${visibility === m.id ? 'chip-lime' : 'glass bg-white hover:border-black/25'}`}
          >
            <m.icon size={14} className={visibility === m.id ? 'text-lime-deep mt-0.5' : 'text-fog mt-0.5'} />
            <span className="min-w-0">
              <span className={`block text-[12.5px] font-semibold ${visibility === m.id ? 'text-lime-deep' : 'text-ink'}`}>{m.title}</span>
              <span className={`block text-[11px] leading-snug mt-0.5 ${visibility === m.id ? 'text-lime-deep/80' : 'text-fog'}`}>{m.body}</span>
            </span>
            {visibility === m.id && <Check size={13} className="ml-auto mt-0.5 text-lime-deep shrink-0" />}
          </button>
        ))}
      </div>
      <div className="hairline rounded-xl bg-panel2 p-1.5 flex items-center gap-2">
        <span className="flex-1 truncate font-mono text-[11px] text-fog pl-2">{link}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(link).then(() => onToast('Share link copied')).catch(() => window.prompt('Copy the share link:', link))}
          className="btn-grad rounded-lg px-3.5 py-2 text-[11.5px] font-semibold shrink-0"
        >
          Copy link
        </button>
      </div>
      <p className="text-[10px] font-mono text-fog/70 mt-3 leading-relaxed">
        Visibility is enforced on the server: private decks return a private screen for unsigned viewers, everywhere.
      </p>
    </motion.div>
  );
}

import { Eye as Eye1, Link2 as Link22, Lock as Lock2 } from 'lucide-react';

function ExportMenu({ project, onJson, onReady }: { project: Project; onJson: () => void; onReady: () => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-quiet rounded-lg px-3.5 py-2 text-[12.5px]">
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 glass-deep bg-white rounded-xl overflow-hidden w-56 z-30">
          <button onClick={() => { onReady(); setOpen(false); }} className="w-full text-left px-4 py-3 text-[13px] hover:bg-panel2 flex items-center gap-2.5 transition-colors">
            <Download size={14} className="text-lime-deep" /> Export center <span className="text-fog/60 text-[10px] ml-auto">web · pdf · pptx</span>
          </button>
          <button onClick={() => nav(`/present/${project.id}?print=1`)} className="w-full text-left px-4 py-3 text-[13px] hover:bg-panel2 flex items-center gap-2.5 transition-colors">
            <FileText size={14} className="text-lime-deep" /> PDF document <span className="text-fog/60 text-[10px] ml-auto">print</span>
          </button>
          <button
            onClick={() => { onJson(); setOpen(false); }}
            className="w-full text-left px-4 py-3 text-[13px] hover:bg-panel2 flex items-center gap-2.5 transition-colors"
          >
            <FileJson size={14} className="text-sage-deep" /> presentation.v1 schema <span className="text-fog/60 text-[10px] ml-auto">json</span>
          </button>
        </div>
      )}
    </div>
  );
}
