import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BarChart3, Check, Download, FileText, Globe, Image as ImageIcon, Lock,
  MousePointer2, Pause, Play, Plus, Printer, Sparkles, Type, X, Zap,
} from 'lucide-react';
import Logo from '../components/layout/Logo';

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em]">
      {children}
    </span>
  );
}

const LILAC = '#EAE6F5';
const LILAC_DEEP = '#5A4E86';

/* ================================================== 1 · AI EDITING */

const THESIS_VARIANTS = {
  base: 'Linear gives product teams one calm system where work actually ships.',
  bolder: 'Linear is the operating system for product velocity — everything else is a spreadsheet wearing a UI.',
  market: '10,000+ product teams ship 2× faster on Linear, while incumbents still sell dashboards about work.',
  shorter: 'Linear turns project chaos into shipped product.',
};

const SUGGESTIONS = [
  { id: 'bolder', label: 'Bolder' },
  { id: 'market', label: 'Market-oriented' },
  { id: 'shorter', label: 'Shorter for investors' },
  { id: 'restage', label: 'Restage current line' },
];

export function AiEditShowcase() {
  const [thesis, setThesis] = useState(THESIS_VARIANTS.base);
  const [active, setActive] = useState<string>('base');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [directed, setDirected] = useState('');
  const [animKey, setAnimKey] = useState(0);

  const apply = (key: string) => {
    setBusy(true);
    setDirected('');
    setTimeout(() => {
      if (key === 'restage') {
        setThesis(THESIS_VARIANTS.base);
      } else {
        setThesis(THESIS_VARIANTS[key as keyof typeof THESIS_VARIANTS] || THESIS_VARIANTS.base);
      }
      setActive(key);
      setAnimKey((k) => k + 1);
      setBusy(false);
    }, 420);
  };

  const applyPrompt = () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setTimeout(() => {
      const low = p.toLowerCase();
      if (low.includes('bold') || low.includes('strong')) setThesis(THESIS_VARIANTS.bolder);
      else if (low.includes('market') || low.includes('compet')) setThesis(THESIS_VARIANTS.market);
      else if (low.includes('short') || low.includes('tight')) setThesis(THESIS_VARIANTS.shorter);
      else setThesis('Linear hands product teams their flow state back — one calm system, zero status theater.');
      setDirected(p);
      setActive('custom');
      setAnimKey((k) => k + 1);
      setPrompt('');
      setBusy(false);
    }, 650);
  };

  return (
    <section id="ai-edit" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div {...rise()}>
          <SectionPill>AI editing</SectionPill>
          <h2 className="font-display text-4xl md:text-[52px] font-semibold tracking-[-0.03em] mt-5 leading-[1.04]">
            Rewrite the story with <span className="font-serif italic font-normal text-grad">one sentence.</span>
          </h2>
          <p className="text-fog mt-6 leading-relaxed text-[15px] max-w-md">
            The copilot works on the live deck — bolder logic, market framing, investor-length copy, or a clean
            restage of the current line. Every suggestion applies instantly and lands in version history.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {[
              'Four studio-grade rewrites, one tap each',
              'Free-form direction — “make the problem slide sting”',
              'Changes stream into the canvas, chat and share links',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[13.5px] text-ink/80">
                <span className="w-7 h-7 rounded-lg bg-white hairline flex items-center justify-center shrink-0">
                  <Check size={13} className="text-lime-deep" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* lilac canvas */}
        <motion.div {...rise(0.1)}>
          <div className="rounded-[28px] p-6 md:p-8 hairline relative overflow-hidden noise" style={{ background: LILAC }}>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-ink/50">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-deep animate-pulse-soft" />
              Live canvas · thesis — 04
              <span className="ml-auto inline-flex items-center gap-1.5"><Sparkles size={11} style={{ color: LILAC_DEEP }} /> copilot</span>
            </div>

            <div className="mt-6 min-h-[150px]">
              <motion.p
                key={animKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: busy ? 0.45 : 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-medium text-[22px] md:text-[26px] leading-[1.3] tracking-[-0.015em] text-ink"
              >
                {thesis}
              </motion.p>
              {directed && (
                <span className="inline-flex items-center gap-1.5 mt-4 chip-lime rounded-full px-3 py-1 text-[10px] font-mono">
                  Directed: “{directed}”
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => apply(s.id)}
                  className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                    active === s.id ? 'bg-ink text-paper' : 'bg-white hairline text-ink/70 hover:text-ink hover:border-black/25'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyPrompt()}
                placeholder="Custom prompt — “Warmer, less technical…”"
                className="flex-1 bg-white hairline rounded-xl px-4 py-3 text-[13px] outline-none focus:border-lime-deep/50 min-w-0"
              />
              <button
                onClick={applyPrompt}
                disabled={busy || !prompt.trim()}
                className="btn-grad rounded-xl px-4 py-3 text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {busy ? <Sparkles size={13} className="animate-pulse" /> : <Sparkles size={13} />}
                Apply edit
              </button>
            </div>
          </div>
          <p className="text-[11px] font-mono text-fog mt-4 text-center">Edits on this page are simulated — in the studio they run against your live deck.</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================== 2 · MANUAL EDITOR */

const ACCENTS = [
  { id: 'lime', hex: '#a3c224' },
  { id: 'ink', hex: '#17170f' },
  { id: 'sage', hex: '#7fa372' },
  { id: 'lilac', hex: LILAC_DEEP },
];
const ED_LAYOUTS = [
  { id: 'editorial', label: 'Editorial' },
  { id: 'data', label: 'Data focus' },
  { id: 'centered', label: 'Centered' },
];

export function ManualEditorShowcase() {
  const [tool, setTool] = useState<'select' | 'type' | 'image' | 'chart' | 'add'>('select');
  const [layout, setLayout] = useState('editorial');
  const [accent, setAccent] = useState('#a3c224');
  const [version, setVersion] = useState(12);
  const [presenting, setPresenting] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [bars, setBars] = useState([44, 68, 52]);
  const [metric, setMetric] = useState('124%');
  const [headline, setHeadline] = useState('Retention compounding, quarter after quarter');
  const touch = () => setVersion((v) => v + 1);

  const pickTool = (t: typeof tool) => {
    if (t === 'add') {
      if (bars.length < 6) { const heights = [62, 38, 76]; setBars([...bars, heights[(bars.length - 3) % heights.length]]); touch(); }
      return;
    }
    if (t === 'image') { setShowImage((v) => !v); setTool(t); touch(); return; }
    setTool(t);
  };

  const body = (
    <div className="flex-1 flex flex-col p-5">
      <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-fog">Editorial · slide 06</p>
      <div className={layout === 'data' ? 'mt-4 flex flex-col' : layout === 'centered' ? 'mt-4 flex flex-col items-center text-center' : 'mt-4 grid grid-cols-[1.15fr_0.85fr] gap-5 items-start'}>
        <div className={layout === 'centered' ? 'flex flex-col items-center' : ''}>
          <div
            contentEditable={tool === 'type'}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => { setHeadline(e.currentTarget.innerText); touch(); }}
            className={`font-display font-semibold tracking-[-0.02em] leading-[1.08] outline-none ${layout === 'data' ? 'text-[19px]' : 'text-[24px]'} ${tool === 'type' ? 'editable-field cursor-text' : ''}`}
          >
            {headline}
          </div>
          <div
            contentEditable={tool === 'type'}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => { setMetric(e.currentTarget.innerText); touch(); }}
            className={`font-display font-semibold mt-3 tracking-tight outline-none ${layout === 'data' ? 'text-[44px]' : 'text-[34px]'} ${tool === 'type' ? 'editable-field cursor-text' : ''}`}
            style={{ color: accent }}
          >
            {metric}
          </div>
          {showImage && (
            <div className="mt-3 rounded-xl hairline flex items-center justify-center gap-2 text-[11px] font-mono text-fog" style={{ background: LILAC, width: 210, height: 74 }}>
              <ImageIcon size={13} /> hero-evidence.png
            </div>
          )}
        </div>

        {/* chart */}
        <div className={`${layout === 'centered' ? 'w-full mt-4' : layout === 'data' ? 'mt-4' : ''} ${tool === 'chart' ? 'ring-2 ring-lime-deep/60 rounded-xl' : ''} transition-shadow`}>
          <div className="flex items-end gap-2.5 h-[110px] rounded-xl hairline bg-white p-3.5">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                <motion.div
                  className="w-full rounded-t-md"
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: i === bars.length - 1 ? accent : 'rgba(23,23,15,0.14)' }}
                />
                <span className="text-[8px] font-mono text-fog">Q{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section id="editor" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-center">
        <motion.div {...rise()}>
          <SectionPill>Manual editor</SectionPill>
          <h2 className="font-display text-4xl md:text-[52px] font-semibold tracking-[-0.03em] mt-5 leading-[1.04]">
            Direct hands.<br /> No middlemen.
          </h2>
          <p className="text-fog mt-6 leading-relaxed text-[15px] max-w-md">
            When the AI lands 90%, your hands take the last ten. Click any word to rewrite it, restage the
            composition, retune the accent — every move saves a new version instantly.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {[
              'Real tools — select, type, image, chart, add',
              'Layouts: Editorial, Data focus, Centered',
              'Per-slide accents, motion and media',
              'Auto-versioned; present without leaving the canvas',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[13.5px] text-ink/80">
                <span className="w-7 h-7 rounded-lg bg-white hairline flex items-center justify-center shrink-0">
                  <Check size={13} className="text-lime-deep" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-[13.5px] font-medium text-lime-deep hover:text-ink transition-colors mt-9">
            Open the editor <ArrowRight size={14} />
          </Link>
        </motion.div>

        {/* black tablet chrome */}
        <motion.div {...rise(0.1)}>
          <div className="rounded-[30px] bg-[#17170f] p-2.5 shadow-[0_48px_100px_-44px_rgba(23,23,15,0.55)]">
            <div className="rounded-[22px] overflow-hidden" style={{ background: LILAC }}>
              {/* mock toolbar */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#17170f] text-white/90">
                {(
                  [
                    { id: 'select', icon: MousePointer2, tip: 'Select' },
                    { id: 'type', icon: Type, tip: 'Type' },
                    { id: 'image', icon: ImageIcon, tip: 'Image' },
                    { id: 'chart', icon: BarChart3, tip: 'Chart' },
                    { id: 'add', icon: Plus, tip: 'Add bar' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    title={t.tip}
                    onClick={() => pickTool(t.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${tool === t.id ? 'bg-[#d9f26b] text-[#17170f]' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                  >
                    <t.icon size={13} />
                  </button>
                ))}
                <span className="ml-2 hidden sm:flex gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setAccent(a.hex); touch(); }}
                      className={`w-5 h-5 rounded-full transition-transform ${accent === a.hex ? 'ring-2 ring-white scale-110' : 'ring-1 ring-white/20 hover:scale-105'}`}
                      style={{ background: a.hex }}
                    />
                  ))}
                </span>
                <span className="ml-auto text-[9.5px] font-mono text-white/40 hidden md:inline">vistara — editor</span>
                <span className="text-[9.5px] font-mono bg-white/10 text-[#d9f26b] rounded-full px-2 py-0.5">v{version}</span>
                {!presenting ? (
                  <button onClick={() => setPresenting(true)} className="ml-1.5 flex items-center gap-1.5 text-[10px] font-mono bg-[#d9f26b] text-[#17170f] rounded-full px-3 py-1.5 font-semibold">
                    <Play size={10} /> PRESENT
                  </button>
                ) : (
                  <button onClick={() => setPresenting(false)} className="ml-1.5 flex items-center gap-1.5 text-[10px] font-mono bg-white/15 text-white rounded-full px-3 py-1.5 font-semibold">
                    <X size={10} /> EXIT
                  </button>
                )}
              </div>

              {/* layouts row */}
              {!presenting && (
                <div className="flex items-center gap-2 px-3.5 py-2 border-b border-black/[0.07]">
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-ink/45">Layout</span>
                  {ED_LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setLayout(l.id); touch(); }}
                      className={`rounded-full px-3 py-1 text-[10.5px] font-medium transition-all ${layout === l.id ? 'bg-ink text-paper' : 'bg-white/70 hairline text-ink/60 hover:text-ink'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                  {tool === 'type' && <span className="ml-auto text-[9px] font-mono text-lime-deep bg-lime rounded-full px-2 py-0.5">TYPE MODE — click the headline or the {metric}</span>}
                </div>
              )}

              {/* canvas */}
              <div className={presenting ? 'min-h-[320px] flex' : 'min-h-[300px] flex'}>
                {presenting ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <p className="text-[9px] font-mono uppercase tracking-[0.24em] text-ink/45">Presenting · 06 / 11</p>
                    <h3 className="font-display font-semibold text-[30px] leading-[1.1] tracking-[-0.02em] mt-4 max-w-md">{headline}</h3>
                    <p className="font-display font-semibold text-[52px] tracking-tight mt-3" style={{ color: accent }}>{metric}</p>
                    <div className="flex items-end gap-2 h-[64px] mt-6">
                      {bars.map((h, i) => (
                        <div key={i} className="w-10 rounded-t-md" style={{ height: `${h * 0.6}%`, background: i === bars.length - 1 ? accent : 'rgba(23,23,15,0.18)' }} />
                      ))}
                    </div>
                    <button onClick={() => setPresenting(false)} className="mt-8 text-[10.5px] font-mono bg-ink text-paper rounded-full px-4 py-2 flex items-center gap-1.5">
                      <X size={11} /> Exit presentation
                    </button>
                  </motion.div>
                ) : (
                  body
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] font-mono text-fog mt-4 text-center">Fully clickable — try the tools, swatches and layouts. Every change bumps the version.</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================== 3 · INTERACTIVE PRESENTATION */

const STREAM = [
  { k: 'Cover', t: 'Why now — the calm-workspace opening', body: 'The room walks in already believing the problem.' },
  { k: 'Evidence', t: '2× shipping velocity, on the record', body: 'Numbers pulled from the live site, not adjectives.' },
  { k: 'Objection', t: 'Migration in a day, not a quarter', body: 'The risk slide arrives before anyone raises it.' },
  { k: 'Proof', t: '10,000 teams shipping on Linear', body: 'Receipts and logos, sequenced for momentum.' },
  { k: 'Ask', t: 'Pilot next quarter', body: 'One decision, framed and dated.' },
];

export function PresentationShowcase() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => {
        setIdx((i) => {
          if (i >= STREAM.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 1800);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing]);

  const row = STREAM[idx];

  return (
    <section id="present" className="max-w-6xl mx-auto px-6 py-24 border-t border-line text-center">
      <motion.div {...rise()}>
        <SectionPill>Interactive presentation</SectionPill>
        <h2 className="font-display text-4xl md:text-[56px] font-semibold tracking-[-0.03em] mt-5 leading-[1.02] max-w-2xl mx-auto">
          More than slides. A controlled product experience.
        </h2>
        <p className="text-fog max-w-xl mx-auto mt-5 leading-relaxed text-[15px]">
          Play the tour and the deck walks itself down the decision stream — or click any row and jump straight to the moment that matters.
        </p>
      </motion.div>

      <motion.div {...rise(0.12)} className="mt-12 max-w-4xl mx-auto">
        <div className="rounded-[30px] bg-[#17170f] p-2.5 shadow-[0_48px_100px_-44px_rgba(23,23,15,0.55)]">
          <div className="rounded-[22px] overflow-hidden grid md:grid-cols-[1.15fr_0.85fr]" style={{ background: LILAC }}>
            {/* stage */}
            <div className="p-7 md:p-9 flex flex-col justify-between min-h-[300px] text-left relative overflow-hidden">
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.22em] text-ink/50">
                <span className={`w-1.5 h-1.5 rounded-full ${playing ? 'animate-pulse-soft' : ''}`} style={{ background: playing ? '#a3c224' : '#9db494' }} />
                Decision stream
                <span className="ml-auto">{String(idx + 1).padStart(2, '0')} / {String(STREAM.length).padStart(2, '0')}</span>
              </div>
              <motion.div key={idx} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mt-6">
                <span className="chip-lime rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-[0.16em]">{row.k}</span>
                <h3 className="font-display font-semibold text-[26px] md:text-[30px] leading-[1.12] tracking-[-0.02em] mt-3 max-w-sm">{row.t}</h3>
                <p className="text-[13px] text-ink/60 mt-3 max-w-sm leading-relaxed">{row.body}</p>
              </motion.div>
              <div className="flex gap-1.5 mt-8">
                {STREAM.map((_, i) => (
                  <span key={i} className="h-1 rounded-full flex-1 overflow-hidden bg-black/[0.08]">
                    <span
                      className="block h-full rounded-full transition-all duration-500"
                      style={{ width: i < idx ? '100%' : i === idx ? (playing ? '100%' : '100%') : '0%', background: i <= idx ? '#17170f' : 'transparent', opacity: i === idx ? 1 : 0.45 }}
                    />
                  </span>
                ))}
              </div>
            </div>

            {/* stream rows */}
            <div className="bg-[#17170f] p-4 md:p-5 flex flex-col gap-2 text-left">
              {STREAM.map((s, i) => {
                const on = i === idx;
                return (
                  <button
                    key={s.k}
                    onClick={() => { setIdx(i); setPlaying(false); }}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all text-left ${
                      on ? 'bg-[#d9f26b] text-[#17170f]' : i < idx ? 'text-white/85 hover:bg-white/10' : 'text-white/40 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    <span className={`text-[10px] font-mono ${on ? 'text-[#42570a]' : 'text-white/35'}`}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className={`block text-[10px] font-mono uppercase tracking-[0.16em] ${on ? 'text-[#42570a]' : 'text-white/40'}`}>{s.k}</span>
                      <span className="block text-[12.5px] font-medium truncate">{s.t}</span>
                    </span>
                    {on && <ArrowRight size={13} className="ml-auto shrink-0" />}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  if (idx >= STREAM.length - 1 && !playing) setIdx(0);
                  setPlaying((p) => !p);
                }}
                className="mt-1 rounded-xl px-4 py-3.5 text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{ background: playing ? 'rgba(255,255,255,0.12)' : '#d9f26b', color: playing ? '#fff' : '#17170f' }}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                {playing ? 'Pause the tour' : idx >= STREAM.length - 1 ? 'Replay the product tour' : 'Play the product tour'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-[11px] font-mono text-fog mt-4">Every shared link presents like this — guided, jumpable, always current.</p>
      </motion.div>
    </section>
  );
}

/* ================================================== 4 · EXPORT + FOOTER */

const FORMATS = [
  { id: 'pdf', icon: Printer, label: 'PDF', desc: 'Print-perfect A4 landscape — the deck as a document of record.', action: 'Open print sheet' },
  { id: 'pptx', icon: FileText, label: 'PPTX', desc: 'Structured outline packet your slides team can rebuild natively.', action: 'Download sample packet' },
  { id: 'web', icon: Globe, label: 'Web', desc: 'An unlisted live link that re-renders with every edit. Instant updates.', action: 'Copy live link' },
  { id: 'embed', icon: Download, label: 'Embed', desc: 'Drop the deck into your site, wiki or portal with one snippet.', action: 'Copy embed snippet' },
];

export function FooterSection() {
  const [format, setFormat] = useState('web');
  const [copied, setCopied] = useState('');

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2200);
    } catch { /* clipboard unavailable */ }
  };

  const liveLink = `${window.location.origin}/gallery`;
  const embedCode = `<iframe src="${liveLink}" width="1280" height="720" style="border:0;border-radius:16px" allowfullscreen title="Vistara deck"></iframe>`;

  const downloadPacket = useCallback(() => {
    const rows = [{ type: 'note', title: 'Vistara Studio', subtitle: 'Sample packet', body: 'Run a live analysis to generate the full packet.', bullets: [] } as unknown as import('../types').Slide];
    const md = [
      '# Vistara Studio — Sample deck packet',
      `Source study: https://linear.app`,
      `Exported ${new Date().toLocaleString()} · private by default · live at ${liveLink}`,
      '',
      ...rows.flatMap((s, i) => [
        `## ${String(i + 1).padStart(2, '0')} · ${(s.title || s.type).replace(/\*/g, '')}`,
        s.subtitle ? `_${s.subtitle}_` : '',
        s.body || '',
        ...((s.bullets ?? []).map((b) => `- ${b}`)),
        '',
      ]),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vistara-linear-sample-packet.md';
    a.click();
    URL.revokeObjectURL(a.href);
    setCopied('packet');
    setTimeout(() => setCopied(''), 2200);
  }, [liveLink]);

  const runAction = () => {
    if (format === 'pdf') window.open('/gallery', '_blank');
    if (format === 'pptx') downloadPacket();
    if (format === 'web') copy(liveLink, 'web');
    if (format === 'embed') copy(embedCode, 'embed');
  };

  const active = FORMATS.find((f) => f.id === format)!;
  const doneFor = (id: string) => copied === id || (id === 'pptx' && copied === 'packet');

  return (
    <>
      {/* export band */}
      <section id="export" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...rise()}>
            <SectionPill>Export & share</SectionPill>
            <h2 className="font-display text-4xl md:text-[52px] font-semibold tracking-[-0.03em] mt-5 leading-[1.04]">
              Built to leave <span className="font-serif italic font-normal text-grad">the room.</span>
            </h2>
            <p className="text-fog mt-6 leading-relaxed text-[15px] max-w-md">
              Present live, or hand over something that survives the meeting. Every format stays in sync with the deck —
              edit at 9:00, the link and the packet already know by 9:01.
            </p>
            <div className="flex flex-col gap-3 mt-8">
              <div className="flex items-center gap-3 text-[13px] text-ink/80">
                <span className="w-7 h-7 rounded-lg bg-white hairline flex items-center justify-center shrink-0">
                  <Lock size={13} className="text-lime-deep" />
                </span>
                Private by default — unlisted links, no indexing, no sign-up walls.
              </div>
              <div className="flex items-center gap-3 text-[13px] text-ink/80">
                <span className="w-7 h-7 rounded-lg bg-white hairline flex items-center justify-center shrink-0">
                  <Zap size={13} className="text-lime-deep" />
                </span>
                Instant updates — shared links and embeds re-render on every save.
              </div>
            </div>
          </motion.div>

          {/* format picker */}
          <motion.div {...rise(0.1)} className="glass rounded-3xl p-6 md:p-7 bg-white noise relative">
            <div className="grid grid-cols-4 gap-1.5">
              {FORMATS.map((f) => {
                const on = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-xl py-3 flex flex-col items-center gap-1.5 text-[11px] font-medium transition-all ${on ? 'bg-ink text-paper' : 'bg-panel2 hairline text-fog hover:text-ink'}`}
                  >
                    <f.icon size={15} />
                    {f.label}
                    {doneFor(f.id) && <Check size={10} className="text-lime" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-2xl bg-panel2 hairline p-5">
              <p className="text-[13.5px] font-medium">{active.label} export</p>
              <p className="text-[12.5px] text-fog mt-1 leading-relaxed">{active.desc}</p>
              <button onClick={runAction} className="chip-lime rounded-xl px-5 py-3 text-[12.5px] font-semibold mt-4 flex items-center gap-2 hover:brightness-95 transition-all">
                {doneFor(format) ? <Check size={14} /> : <Download size={14} />}
                {doneFor(format) ? (format === 'web' || format === 'embed' ? 'Copied to clipboard' : 'Packet downloaded') : active.action}
              </button>
              {format === 'embed' && !copied && (
                <p className="mt-3 font-mono text-[10px] text-fog/80 break-all leading-relaxed">{embedCode}</p>
              )}
            </div>
            <p className="text-[10.5px] font-mono text-fog/70 mt-4 text-center">Sample packets render from the live Linear study in this workspace.</p>
          </motion.div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-line bg-white/70">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-8">
          <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
            <div>
              <Logo />
              <p className="text-fog text-[13px] leading-relaxed mt-4 max-w-xs">
                Website intelligence, presented. Crawl the live site, audit it, understand it — and leave with
the story already designed.
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {['Embedded product demos', 'Live data layers', 'Guided interactions'].map((t) => (
                  <span key={t} className="text-[10.5px] font-mono hairline bg-panel2 rounded-full px-3 py-1.5 text-fog">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-fog mb-4">Studio</p>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Link to="/dashboard" className="text-ink/75 hover:text-ink transition-colors">Workspace</Link>
                <a href="#new-study" className="text-ink/75 hover:text-ink transition-colors">Analyze a site</a>
                <a href="#how" className="text-ink/75 hover:text-ink transition-colors">How it works</a>
                <a href="#design" className="text-ink/75 hover:text-ink transition-colors">Design system</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-fog mb-4">Live samples</p>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Link to="/gallery" className="text-ink/75 hover:text-ink transition-colors">Browse public showcases</Link>
                <Link to="/gallery" className="text-ink/75 hover:text-ink transition-colors">Open showcase gallery</Link>
                <a href="#audit" className="text-ink/75 hover:text-ink transition-colors">Audit engine</a>
                <a href="#editor" className="text-ink/75 hover:text-ink transition-colors">Editor tour</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-fog mb-4">Assurance</p>
              <div className="flex flex-col gap-2.5 text-[13px] text-ink/75">
                <span className="flex items-center gap-2"><Lock size={12} className="text-sage-deep" /> Private by default</span>
                <span className="flex items-center gap-2"><Zap size={12} className="text-sage-deep" /> Instant updates</span>
                <span className="flex items-center gap-2"><Globe size={12} className="text-sage-deep" /> Real crawls only</span>
              </div>
            </div>
          </div>
          <div className="border-t border-line mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11px] font-mono text-fog">© {new Date().getFullYear()} Vistara Studio — Website intelligence, presented.</p>
            <p className="text-[11px] font-mono text-fog tracking-wider uppercase">Read · Audit · Understand · Present · Export</p>
          </div>
        </div>
      </footer>
    </>
  );
}
