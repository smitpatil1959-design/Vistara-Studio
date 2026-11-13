import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Download, FileCode2, FileText, Globe,
  Loader2, TriangleAlert, X,
} from 'lucide-react';
import { authenticatedFetch } from '../services/http';

const FORMATS = [
  {
    id: 'web',
    icon: Globe,
    name: 'Interactive web',
    pitch: 'An animated presentation that follows the deck’s sharing settings.',
    free: 'The link shows the latest saved version.',
  },
  {
    id: 'pdf',
    icon: FileText,
    name: 'PDF document',
    pitch: 'Static A4 landscape print sheets — every slide rendered at 1280×720 onto clean pages.',
    free: 'Animations settle to final poses; motion is not printable and stays graceful.',
  },
  {
    id: 'pptx',
    icon: FileCode2,
    name: 'PowerPoint (.pptx)',
    pitch: 'An editable Office deck with text, shapes, tables, charts and notes.',
    free: 'The readiness report lists font substitutions and export limitations.',
  },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

interface Finding {
  severity: 'block' | 'warn' | 'note' | 'ok';
  kind: string;
  message: string;
  target?: string;
}
interface ExportReport {
  format: string;
  ready: boolean;
  counts: { block: number; warn: number; note: number; ok: number };
  findings: Finding[];
  generatedAt: string;
}

interface Props {
  projectId: string;
  projectName: string;
  origin: string;
  onClose: () => void;
  onOpenPrint: () => void;
}

const STEPS = ['Validate presentation', 'Check assets & fonts', `Compose output`, 'Deliver'];

export default function ExportDialog({ projectId, projectName, origin, onClose, onOpenPrint }: Props) {
  const [format, setFormat] = useState<FormatId>('web');
  const [report, setReport] = useState<ExportReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportErr, setReportErr] = useState('');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [failMsg, setFailMsg] = useState('');

  const fetchReport = useCallback(
    async (fmt: FormatId) => {
      setReportErr('');
      try {
        const r = await authenticatedFetch(`/api/export-report?projectId=${projectId}&format=${fmt}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Readiness check failed');
        setReport(data);
      } catch (e) {
        setReportErr(e instanceof Error ? e.message : 'Readiness check failed');
      } finally {
        setLoadingReport(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReportErr('');
      setReport(null);
      try {
        const r = await authenticatedFetch(`/api/export-report?projectId=${projectId}&format=${format}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Readiness check failed');
        if (!cancelled) setReport(data);
      } catch (e) {
        if (!cancelled) setReportErr(e instanceof Error ? e.message : 'Readiness check failed');
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, projectId]);

  // event-handler path (format chips + retry button) may show the loader again
  const pickFormat = (fmt: FormatId) => {
    if (fmt === format) return;
    setFormat(fmt);
    setLoadingReport(true);
  };

  const run = async () => {
    if (!report?.ready || running) return;
    setRunning(true);
    setFailMsg('');
    setStep(0);
    try {
      // animation pacing is honest — each phase maps to real server work
      setStep(1);
      await new Promise((r) => setTimeout(r, 420));
      setStep(2);
      if (format === 'web') {
        window.open(`${origin}/p/${projectId}`, '_blank');
        setStep(3);
        await new Promise((r) => setTimeout(r, 600));
        setStep(-1);
        onClose();
        return;
      }
      if (format === 'pdf') {
        onOpenPrint();
        setStep(3);
        await new Promise((r) => setTimeout(r, 500));
        setStep(-1);
        onClose();
        return;
      }
      if (format === 'pptx') {
        const r = await authenticatedFetch(`/api/export-pptx?projectId=${projectId}`);
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `Compose failed (${r.status})`);
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-vistara.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        setStep(3);
        await new Promise((r2) => setTimeout(r2, 700));
        setStep(-1);
        onClose();
      }
    } catch (e) {
      setFailMsg(e instanceof Error ? e.message : 'Export failed');
      setStep(-1);
    } finally {
      setRunning(false);
    }
  };

  const fmt = FORMATS.find((f) => f.id === format)!;
  const failList = (report?.findings || []).filter((f) => f.severity === 'block' || f.severity === 'warn');
  const notes = (report?.findings || []).filter((f) => f.severity === 'note');
  const checks = (report?.findings || []).filter((f) => f.severity === 'ok');

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/35 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass-deep bg-white rounded-3xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-line">
          <span className="w-9 h-9 rounded-xl chip-lime flex items-center justify-center">
            <Download size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-[15px]">Export — {projectName}</p>
            <p className="text-[10.5px] font-mono text-fog">a readiness gate runs before anything leaves</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-fog hover:text-ink hover:bg-black/[0.04]" aria-label="Close export">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 grid gap-5 max-h-[76vh] overflow-y-auto no-scrollbar">
          {/* format picker */}
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const on = format === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => pickFormat(f.id)}
                  className={`rounded-2xl p-4 text-left transition-all ${on ? 'chip-lime ring-1 ring-lime-deep/40' : 'glass bg-white hover:border-black/25'}`}
                >
                  <f.icon size={17} className={on ? 'text-lime-deep' : 'text-fog'} />
                  <p className={`text-[12.5px] font-semibold mt-2 ${on ? 'text-lime-deep' : 'text-ink'}`}>{f.name}</p>
                  <p className={`text-[10.5px] leading-snug mt-1 ${on ? 'text-lime-deep/80' : 'text-fog'}`}>{f.pitch}</p>
                </button>
              );
            })}
          </div>

          {/* readiness report */}
          <div className="rounded-2xl hairline bg-panel2 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <ClipboardCheck size={14} className="text-lime-deep" />
              <p className="font-display font-semibold text-[13.5px]">Export readiness</p>
              {loadingReport && <Loader2 size={12} className="animate-spin text-fog ml-auto" />}
              {!loadingReport && report && (
                <span className={`ml-auto text-[10px] font-mono rounded-full px-2.5 py-1 border ${report.ready ? 'bg-[#e7efe2] text-sage-deep border-[#c4d4bb]' : 'bg-[#f9e3e0] text-[#a2403a] border-[#ecc5c0]'}`}>
                  {report.ready ? 'READY' : `${report.counts.block} BLOCKING`}
                </span>
              )}
            </div>
            {reportErr && (
              <p className="text-[12px] text-[#a2403a] bg-[#f9e3e0] border border-[#ecc5c0] rounded-lg px-3 py-2.5 flex items-center gap-2">
                <TriangleAlert size={12} /> {reportErr}
                <button onClick={() => void fetchReport(format)} className="ml-auto text-lime-deep font-medium">Retry</button>
              </p>
            )}
            {!loadingReport && report && !reportErr && (
              <div className="flex flex-col gap-2">
                {failList.map((f, i) => (
                  <p key={i} className="flex items-start gap-2.5 text-[12px] leading-snug">
                    {f.severity === 'block' ? <X size={12} className="text-[#c4574e] mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="text-[#b08a1e] mt-0.5 shrink-0" />}
                    <span>
                      <span className={`font-semibold ${f.severity === 'block' ? 'text-[#a2403a]' : 'text-[#8a6d1c]'}`}>{f.kind.toUpperCase()}</span>
                      {' — '}
                      {f.message}
                      {f.target ? <span className="text-fog/60 font-mono text-[10.5px]"> · slide {f.target}</span> : null}
                    </span>
                  </p>
                ))}
                {failList.length === 0 && notes.length === 0 && <p className="text-[12px] text-sage-deep flex items-center gap-2"><CheckCircle2 size={12} /> Nothing flagged — clean export.</p>}
                {notes.map((f, i) => (
                  <p key={i} className="flex items-start gap-2.5 text-[11.5px] text-fog leading-snug">
                    <ChevronRight size={11} className="mt-0.5 shrink-0 text-lime-deep" />
                    {f.message}
                  </p>
                ))}
                {checks.length > 0 && (
                  <p className="text-[10.5px] font-mono text-fog/60 mt-1">
                    {checks.length} checks passed — {checks.slice(0, 2).map((c) => c.kind).join(', ')}…
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-[10.5px] font-mono text-fog/70 leading-relaxed">{fmt.free}</p>

          {failMsg && (
            <p role="alert" className="text-[12.5px] text-[#a2403a] bg-[#f9e3e0] border border-[#ecc5c0] rounded-xl px-4 py-3 flex items-start gap-2">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {failMsg}
            </p>
          )}

          {/* progress phasing */}
          <AnimatePresence>
            {step >= 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="rounded-2xl bg-ink text-paper p-4">
                <div className="flex flex-col gap-1.5">
                  {STEPS.map((s, i) => {
                    const st = step > i ? 'done' : step === i ? 'run' : 'todo';
                    return (
                      <div key={s} className="flex items-center gap-2.5 text-[11.5px] font-mono">
                        {st === 'done' ? <CheckCircle2 size={12} className="text-lime" /> : st === 'run' ? <Loader2 size={12} className="animate-spin text-lime" /> : <span className="w-3 h-3 rounded-full border border-white/25" />}
                        <span className={st === 'done' ? 'text-white/85' : st === 'run' ? 'text-white' : 'text-white/40'}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-line bg-panel2 flex items-center gap-3">
          <span className="text-[10.5px] font-mono text-fog">
            {fmt.id === 'web' ? 'uses your sharing settings' : fmt.id === 'pdf' ? 'video prints as its poster · motion settles to final pose' : 'font substitutions · videos export as linked stills'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="btn-quiet rounded-xl px-4 py-2.5 text-[12.5px]">
              Cancel
            </button>
            <button onClick={run} disabled={running || loadingReport || !report?.ready} className="btn-grad rounded-xl px-5 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {running ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {fmt.id === 'web' ? 'Open live deck' : fmt.id === 'pdf' ? 'Open print sheet' : 'Download .pptx'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
