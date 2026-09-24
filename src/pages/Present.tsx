import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, FileDown, Loader2, Lock, Maximize, Share2, X, PanelLeft } from 'lucide-react';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { SlideCanvas, SlideRenderer } from '../components/deck/SlideRenderer';
import { SpecStage } from '../components/deck/SpecStage';
import { getSpec } from '../services';
import ExportDialog from '../studio/ExportDialog';
import { buildSpecFromSlides, getRenderableSlides, type PresentationSpec } from '../deck-spec';
import { DEFAULT_THEME } from '../lib/themes';

export default function Present() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { project, slides: rowSlides, loading, error: err } = useProjectDetail(id);
  const [specDoc, setSpecDoc] = useState<PresentationSpec | null>(null);
  const [idx, setIdx] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const idleIdx = useRef(-1);
  const isPrivate = /private/i.test(err || '');

  // hint chip breathes for the first few seconds of each deck
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 5200);
    return () => clearTimeout(t);
  }, []);

  // deck re-announces the hint flag per slide, fades out
  useEffect(() => {
    const last = idleIdx.current;
    idleIdx.current = idx;
    if (last === -1 || last === idx) return;
    const show = setTimeout(() => {
      setHintVisible(true);
      setTimeout(() => setHintVisible(false), 1600);
    }, 0);
    return () => clearTimeout(show);
  }, [idx]);

  // presentation.v1 is the single source of truth: fetched spec wins,
  // otherwise rows are projected into the schema client-side (same document either way)
  useEffect(() => {
    if (loading || !project) return;
    let alive = true;
    getSpec(id)
      .then((row) => { if (alive) setSpecDoc(row.spec); })
      .catch(() => {
        if (alive && rowSlides.length) setSpecDoc(buildSpecFromSlides(project, rowSlides, 'generated'));
      });
    return () => { alive = false; };
  }, [id, loading, project, rowSlides]);

  useEffect(() => {
    if (loading || !project || specDoc || rowSlides.length === 0) return;
    // server sync is asynchronous on first load — derive locally the moment rows arrive
    const t = setTimeout(() => setSpecDoc(buildSpecFromSlides(project, rowSlides, 'generated')), 800);
    return () => clearTimeout(t);
  }, [loading, project, specDoc, rowSlides]);

  const slides = specDoc && specDoc.slides.length ? getRenderableSlides(specDoc) : rowSlides;
  const [showUI, setShowUI] = useState(true);
  const [showRail, setShowRail] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dim, setDim] = useState({ w: 1280, h: 720 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // auto-open the print sheet when arriving with ?print=1
  useEffect(() => {
    if (!loading && slides.length > 0 && params.get('print') === '1') {
      const t = setTimeout(() => setPrinting(true), 900);
      return () => clearTimeout(t);
    }
  }, [loading, slides.length, params]);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.onafterprint = () => setPrinting(false);
      window.print();
      setTimeout(() => setPrinting(false), 800);
    }, 900);
    return () => clearTimeout(t);
  }, [printing]);

  useEffect(() => {
    const onResize = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const poke = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUI(false), 2600);
  }, []);

  useEffect(() => {
    // UI starts visible; the dock auto-hides after first idle window
    hideTimer.current = setTimeout(() => setShowUI(false), 2600);
    window.addEventListener('mousemove', poke);
    return () => {
      window.removeEventListener('mousemove', poke);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [poke]);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const theme = project?.theme || DEFAULT_THEME;
  const dur = theme.motion === 'snappy' ? 0.3 : theme.motion === 'calm' ? 0.8 : 0.55;
  const scale = Math.min(dim.w / 1280, dim.h / 720);
  const darkStage = theme.skin === 'dark';
  const stageBg = darkStage ? '#0B0B10' : '#ECECE5';
  const stageChrome = darkStage;

  if (err) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <div className="glass bg-white rounded-2xl p-10 text-center max-w-sm mx-4">
          <span className="w-12 h-12 rounded-2xl bg-lime-soft hairline flex items-center justify-center text-lime-deep mx-auto mb-4">
            {isPrivate ? <Lock size={20} /> : <X size={20} />}
          </span>
          <p className="font-display font-semibold text-lg">{isPrivate ? 'This presentation is private' : 'Presentation unavailable'}</p>
          <p className="text-fog text-sm mt-2">{isPrivate ? 'Signed-in owners can open it — the link alone is not enough.' : err}</p>
          <div className="flex items-center justify-center gap-2 mt-6">
            {isPrivate && (
              <Link to="/login" className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold inline-block">
                Sign in to view
              </Link>
            )}
            <Link to={isPrivate ? '/' : '/'} className="btn-quiet rounded-xl px-5 py-2.5 text-[13px] font-medium inline-block">
              {isPrivate ? 'Vistara Studio' : 'Vistara Studio'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ECECE5] text-fog flex items-center justify-center gap-3">
        <Loader2 className="animate-spin" size={18} /> Preparing the stage…
      </div>
    );
  }

  if (!project || !specDoc || specDoc.slides.length === 0) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center">
        <div className="glass bg-white rounded-2xl p-10 text-center max-w-sm mx-4">
          <p className="font-display font-semibold text-lg">No slides generated yet</p>
          <p className="text-fog text-sm mt-2">
            This study does not have presentation slides yet. Generate the presentation in the studio first.
          </p>
          <div className="mt-6">
            <Link to={`/project/${id}`} className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold inline-block">
              Open in Studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: stageBg }}>
      {/* stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={specDoc.slides[idx]?.id || idx}
            initial={{ opacity: 0, scale: theme.motion === 'snappy' ? 0.99 : 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.008 }}
            transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: specDoc.canvas.width, height: specDoc.canvas.height, transform: `scale(${scale})` }}
            className="shrink-0 overflow-hidden rounded-[16px]"
          >
            <SpecStage spec={specDoc} index={idx} animate interactive />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* click zones */}
      <button aria-label="Previous slide" onClick={prev} className="absolute left-0 top-0 bottom-0 w-[18%] z-20" style={{ cursor: 'w-resize' }} />
      <button aria-label="Next slide" onClick={next} className="absolute right-0 top-0 bottom-0 w-[18%] z-20" style={{ cursor: 'e-resize' }} />

      {/* brand chip + keyline */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute top-5 left-5 z-40 flex items-center gap-2 glass-deep rounded-full px-3.5 py-2 bg-white/85"
      >
        <svg width="15" height="15" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="32" fill="#17170F" />
          <path d="M32 13 Q34.6 28.4 46 31.5 Q34.6 34.6 32 50 Q29.4 34.6 18 31.5 Q29.4 28.4 32 13 Z" fill="#F4F4EF" />
          <circle cx="32" cy="32" r="2.4" fill="#D9F26B" />
        </svg>
        <span className="text-[11px] font-medium text-ink/85">{project.name}</span>
        <span className="text-[9px] font-mono text-fog">·</span>
        <span className="text-[9.5px] font-mono text-fog uppercase tracking-[0.2em]">vistara present</span>
      </motion.div>

      {/* intro hint — fades away */}
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-6 right-6 z-40 glass-deep rounded-full px-4 py-2 text-[11px] font-mono text-fog"
          >
            → next · ← back · F fullscreen · Esc exits
          </motion.div>
        )}
      </AnimatePresence>

      {/* progress */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-40" style={{ background: stageChrome ? 'rgba(255,255,255,0.06)' : 'rgba(23,23,15,0.08)' }}>
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
          animate={{ width: `${((idx + 1) / slides.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* dock */}
      <motion.div
        animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 12 }}
        transition={{ duration: 0.3 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 rounded-full px-2 py-1.5 flex items-center gap-1 glass-deep"
        style={{ pointerEvents: showUI ? 'auto' : 'none' }}
      >
        <Link to={`/project/${project.id}`} className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors" title="Back to studio">
          <X size={15} />
        </Link>
        <span className="w-px h-4 bg-black/10" />
        <button
          onClick={() => setShowRail((v) => !v)}
          className={`p-2.5 rounded-full transition-colors ${showRail ? 'chip-lime' : 'text-fog hover:text-ink hover:bg-black/[0.05]'}`}
          title="Slide rail"
        >
          <PanelLeft size={15} />
        </button>
        <button onClick={prev} className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors disabled:opacity-30" disabled={idx === 0}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-[11px] font-mono text-fog px-2 min-w-[64px] text-center">
          {String(idx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
        <button onClick={next} className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors disabled:opacity-30" disabled={idx === slides.length - 1}>
          <ChevronRight size={16} />
        </button>
        <span className="w-px h-4 bg-black/10" />
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen().catch(() => {});
          }}
          className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors"
          title="Fullscreen (F)"
        >
          <Maximize size={15} />
        </button>
        <button onClick={() => setExportOpen(true)} className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors" title="Export">
          <FileDown size={15} />
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href.replace('/present/', '/p/'));
            } catch { /* clipboard unavailable */ }
          }}
          className="p-2.5 rounded-full text-fog hover:text-ink hover:bg-black/[0.05] transition-colors"
          title="Copy share link"
        >
          <Share2 size={15} />
        </button>
      </motion.div>

      {exportOpen && project && (
        <ExportDialog
          projectId={project.id}
          projectName={project.name}
          origin={window.location.origin}
          onClose={() => setExportOpen(false)}
          onOpenPrint={() => { setExportOpen(false); setPrinting(true); }}
        />
      )}

      {/* thumbnail rail */}
      <AnimatePresence>
        {showRail && (
          <motion.aside
            initial={{ x: -220, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -220, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 glass-deep rounded-2xl p-2.5 flex flex-col gap-2 max-h-[76vh] overflow-y-auto no-scrollbar"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className={`w-[168px] shrink-0 overflow-hidden rounded-lg transition-all bg-white ${i === idx ? 'ring-2 ring-lime-deep' : 'ring-1 ring-black/10 opacity-60 hover:opacity-100'}`}
              >
                <SlideCanvas slide={s} theme={theme as never} index={i} total={slides.length} />
              </button>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* offline print layer */}
      <div id="print-root">
        {slides.map((s, i) => (
          <div key={s.id} className="print-page">
            <div className="print-inner">
              <SlideRenderer slide={s} theme={theme as never} index={i} total={slides.length} animate={false} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
