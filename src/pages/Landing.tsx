import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, ScanSearch, ShieldCheck, BrainCircuit, Presentation, Wand2, PenTool,
  MessageSquareText, Eye, Gauge, Accessibility, Smartphone, Lock, Link2, Check, Loader2,
  FileText,
} from 'lucide-react';
import Logo from '../components/layout/Logo';
import Ambient from '../components/layout/Ambient';
import { ScoreRing } from '../components/ui';
import UrlStudyForm from '../components/UrlStudyForm';
import { HowItWorks, AuditSection, UnderstandingSection } from '../landing/Sections';
import { AiEditShowcase, ManualEditorShowcase, PresentationShowcase, FooterSection } from '../landing/Showcase';

/* ------------------------------------------------- animated studio preview */

const PREVIEW_STEPS = ['Read URL', 'Analysis', 'Health', 'Story'];
const STORY_LINES = [
  { k: 'Cover', t: 'Meet Linear — the system for modern software development' },
  { k: 'Problem', t: 'Toolchains eat the week; feedback loops are glacial' },
  { k: 'Features', t: 'Cycles · Triage · Roadmaps · Insights' },
  { k: 'Benefits', t: '2× shipping velocity, one calm workspace' },
];

function StudioPreview() {
  const [phase, setPhase] = useState(0);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);

  useEffect(() => {
    let alive = true;
    const seq = async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      while (alive) {
        setPhase(0); setScore(0); setLines(0);
        await wait(1100);
        setPhase(1);
        await wait(1600);
        setPhase(2);
        for (let s = 0; s <= 86; s += 2) {
          if (!alive) return;
          setScore(s);
          await wait(16);
        }
        setScore(86);
        await wait(700);
        setPhase(3);
        for (let i = 1; i <= STORY_LINES.length; i++) {
          setLines(i);
          await wait(480);
        }
        await wait(2600);
      }
    };
    seq();
    return () => { alive = false; };
  }, []);

  return (
    <div className="relative">
      {/* soft lime halo */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-[120%] h-[70%] -z-10"
        style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.65), rgba(226,247,153,0.25) 55%, transparent 80%)', filter: 'blur(48px)' }}
      />
      <div className="glass rounded-2xl overflow-hidden shadow-[0_40px_90px_-40px_rgba(23,23,15,0.35)] relative noise bg-white">
        {/* browser chrome */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel2">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex-1 flex justify-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-fog bg-white hairline rounded-full px-3.5 py-1">
              <Lock size={10} /> studio.vistara.ai/workspace
            </span>
          </span>
          <span className="w-10" />
        </div>

        {/* body */}
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-0">
          {/* left: input + pipeline */}
          <div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-line">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog mb-2.5">New study</p>
            <div className="flex items-center gap-2">
              <div className="input-ghost rounded-xl px-3.5 py-2.5 text-[13px] flex-1 flex items-center gap-2 min-w-0">
                <Globe size={13} className="text-fog shrink-0" />
                <span className="truncate font-mono text-[12.5px]">linear.app</span>
                {phase === 0 && <span className="w-px h-4 bg-ink animate-pulse-soft" />}
              </div>
              <span className="btn-grad rounded-xl px-3.5 py-2.5 text-[12px] font-semibold whitespace-nowrap">Run</span>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {PREVIEW_STEPS.map((s, i) => {
                const state = phase > i ? 'done' : phase === i ? 'run' : 'todo';
                return (
                  <div key={s} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 border transition-all duration-300 ${state === 'run' ? 'chip-lime' : state === 'done' ? 'bg-white border-line' : 'bg-white/60 border-line'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${state === 'done' ? 'bg-sage text-white' : state === 'run' ? 'bg-lime-deep text-lime' : 'bg-black/[0.06] text-fog'}`}>
                      {state === 'done' ? <Check size={11} /> : state === 'run' ? <Loader2 size={11} className="animate-spin" /> : i + 1}
                    </span>
                    <span className={`text-[12.5px] font-medium ${state === 'todo' ? 'text-fog' : 'text-ink'}`}>{s}</span>
                    <span className="ml-auto text-[10px] font-mono text-fog">
                      {state === 'done' && ['1.2s', '5 pages', '86/100', '11 §'][i]}
                      {state === 'run' && '…'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* right: health + story */}
          <div className="p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-5 rounded-xl hairline bg-panel2 px-5 py-4">
              <ScoreRing score={score} size={76} stroke={7} />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog">Website health</p>
                <p className="font-display font-semibold text-[15px] mt-1">{score >= 60 ? 'Strong, with visible seams' : 'Auditing five axes…'}</p>
                <div className="flex gap-1.5 mt-2.5">
                  {[96, 94, 88, 71, 92].map((v, i) => (
                    <span key={i} className="h-1 w-7 rounded-full overflow-hidden bg-black/[0.07] relative">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{ width: phase >= 2 ? `${v}%` : '4%', background: 'linear-gradient(90deg,#9db494,#7fa372)' }}
                      />
                    </span>
                  ))}
                </div>
                <div className="flex gap-2.5 mt-1">
                  {['TEC', 'RES', 'A11Y', 'PERF', 'SEC'].map((l) => (
                    <span key={l} className="w-7 text-[8px] font-mono text-fog">{l}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`rounded-xl hairline bg-white p-5 transition-opacity duration-500 ${phase >= 3 ? 'opacity-100' : 'opacity-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog flex items-center gap-1.5">
                  <FileText size={11} /> Generated story
                </p>
                <span className="text-[10px] font-mono chip-lime rounded-full px-2 py-0.5">11 sections</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[132px]">
                <AnimatePresence>
                  {STORY_LINES.slice(0, lines).map((l) => (
                    <motion.div key={l.k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-lg hairline bg-panel2 px-3 py-2">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-lime-deep bg-lime-soft border border-[#dfeeb0] rounded px-1.5 py-0.5 shrink-0">{l.k}</span>
                      <span className="text-[12px] text-ink/85 truncate">{l.t}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {phase < 3 && <p className="text-[12px] text-fog italic">Waiting for the audit to finish…</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ content */

const PIPELINE = [
  { icon: Globe, title: 'Read', desc: 'Any URL. The studio walks the live site — pages, media, links, design tokens.' },
  { icon: ScanSearch, title: 'Crawl', desc: 'Subpages mapped, destinations probed, DOM parsed into structured signal.' },
  { icon: ShieldCheck, title: 'Audit', desc: 'Technical, responsive, accessibility, performance and security — scored with evidence.' },
  { icon: BrainCircuit, title: 'Understand', desc: 'Product, audience, features, USPs and tone distilled into a creative brief.' },
  { icon: Presentation, title: 'Generate', desc: 'An 11-section narrative composed on a cinematic 16:9 canvas.' },
  { icon: Wand2, title: 'Refine', desc: 'Edit by hand or by sentence. Present, export to PDF, share a link.' },
];

const CAPABILITIES = [
  {
    icon: ShieldCheck, span: 'md:col-span-2', title: 'Website audit engine',
    desc: 'Five axes, real evidence. Every check runs against the live site — broken links probed, headers inspected, alt coverage counted, latency measured.',
    chips: [{ icon: Link2, t: 'Technical' }, { icon: Smartphone, t: 'Responsive' }, { icon: Accessibility, t: 'A11y' }, { icon: Gauge, t: 'Performance' }, { icon: Lock, t: 'Security' }],
  },
  { icon: BrainCircuit, span: '', title: 'AI understanding', desc: 'Name, audience, features, USPs, tone — one editable creative brief.' },
  { icon: Wand2, span: '', title: 'Natural-language editing', desc: '“Sage palette, tighter copy, add pricing” — executed instantly.' },
  { icon: PenTool, span: '', title: 'Manual editor', desc: 'Click any text to rewrite it. Layouts, motion, accents and imagery per slide.' },
  { icon: MessageSquareText, span: 'md:col-span-2', title: 'AI copilot chat', desc: 'A creative director on call — it knows the deck, applies changes surgically, and explains every mutation it makes.' },
  { icon: Eye, span: '', title: 'Present & export', desc: 'Present mode, PDF export and shareable links — the story, delivered.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <Ambient />

      {/* nav */}
      <header className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-fog">
          <a href="#how" className="hover:text-ink transition-colors">How it works</a>
          <a href="#audit" className="hover:text-ink transition-colors">Audit</a>
          <a href="#understanding" className="hover:text-ink transition-colors">Understanding</a>
          <a href="#design" className="hover:text-ink transition-colors">Design system</a>
          <Link to="/gallery" className="hover:text-ink transition-colors">Showcase</Link>
        </nav>
        <Link to="/dashboard" className="btn-quiet text-[13px] font-medium rounded-full px-4 py-2">
          Open Studio
        </Link>
      </header>

      {/* hero — centered with lime halo */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 md:pt-24 pb-8 text-center">
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 w-[760px] h-[380px] -z-10 pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.75), rgba(226,247,153,0.3) 55%, transparent 82%)', filter: 'blur(52px)' }}
        />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[12px] font-medium mb-8 bg-white hairline">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-deep" />
            Website intelligence, presented
          </div>
          <h1 className="font-display font-semibold tracking-[-0.035em] leading-[1.0] text-5xl md:text-[84px] max-w-4xl mx-auto">
            Website intelligence,<br />
            <span className="text-grad">presented.</span>
          </h1>
          <p className="text-fog text-base md:text-lg max-w-xl mx-auto mt-7 leading-relaxed">
            Vistara reads a live website, audits it across five axes, understands what the product is —
            then writes, designs and animates the presentation for you.
          </p>
        </motion.div>

        <motion.div id="new-study" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="max-w-xl mx-auto mt-10 scroll-mt-28">
          <UrlStudyForm />
          <div className="flex items-center justify-center gap-3 mt-5">
            <span className="text-[11px] font-mono text-fog tracking-wider">REAL CRAWL</span>
            <span className="w-1 h-1 rounded-full bg-sage" />
            <span className="text-[11px] font-mono text-fog tracking-wider">LIVE AUDIT</span>
            <span className="w-1 h-1 rounded-full bg-sage" />
            <span className="text-[11px] font-mono text-fog tracking-wider">11-SECTION DECK</span>
            <span className="w-1 h-1 rounded-full bg-sage" />
            <span className="text-[11px] font-mono text-fog tracking-wider">ZERO SIGNUP</span>
          </div>
        </motion.div>
      </section>


      {/* primary-flow ribbon */}
      <section className="border-y border-line bg-white/50 overflow-hidden">
        <div className="flex items-center gap-0 whitespace-nowrap py-3.5" style={{ animation: 'marqueeX 34s linear infinite', width: 'max-content' }}>
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center shrink-0" aria-hidden={dup === 1}>
              {['paste a URL', 'analyze the whole website', 'detect errors', 'understand the product', 'compose the story', 'edit by hand', 'edit by sentence', 'present live', 'export & share'].map((s) => (
                <span key={s} className="flex items-center">
                  <span className="text-[11px] font-mono uppercase tracking-[0.24em] text-fog px-6">{s}</span>
                  <span className="w-1 h-1 rounded-full bg-lime-deep/50" />
                </span>
              ))}
            </div>
          ))}
        </div>
    </section>

      {/* animated studio preview */}
      <section className="max-w-4xl mx-auto px-6 pb-24 pt-4">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}>
          <StudioPreview />
          <p className="text-center text-[11px] font-mono text-fog mt-5 tracking-wider uppercase">Live sequence — url → analysis → health → deck</p>
        </motion.div>
      </section>

      {/* how it works / audit / understanding */}
      <HowItWorks />
      <AuditSection />
      <UnderstandingSection />

      {/* product showcases */}
      <AiEditShowcase />
      <ManualEditorShowcase />
      <PresentationShowcase />

      {/* pipeline */}
      <section id="pipeline" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="text-center">
          <span className="inline-flex items-center gap-2 chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em]">The pipeline</span>
          <h2 className="font-display text-4xl md:text-[56px] font-semibold tracking-[-0.03em] mt-5 leading-[1.02]">
            Six moves,<br className="md:hidden" /> one rehearsal.
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
          {PIPELINE.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.06 }}
              className="glass rounded-2xl p-6 card-hover relative overflow-hidden bg-white"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-lime-soft hairline flex items-center justify-center">
                  <s.icon size={17} className="text-lime-deep" />
                </div>
                <span className="chip-lime rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="font-display font-semibold mt-5 text-[17px]">{s.title}</h3>
              <p className="text-fog text-[13.5px] leading-relaxed mt-1.5">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* capabilities bento */}
      <section id="capabilities" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }} className="text-center">
          <span className="inline-flex items-center gap-2 chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em]">The instrument</span>
          <h2 className="font-display text-4xl md:text-[56px] font-semibold tracking-[-0.03em] mt-5 leading-[1.02]">
            Auditor, analyst,<br /> art director.
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14">
          {CAPABILITIES.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.07 }}
              className={`glass rounded-2xl p-7 card-hover bg-white ${cap.span}`}
            >
              <div className="w-10 h-10 rounded-xl bg-lime-soft hairline flex items-center justify-center">
                <cap.icon size={17} className="text-lime-deep" />
              </div>
              <h3 className="font-display font-semibold mt-4 text-[17px]">{cap.title}</h3>
              <p className="text-fog text-[13.5px] leading-relaxed mt-1.5">{cap.desc}</p>
              {cap.chips && (
                <div className="flex flex-wrap gap-2 mt-5">
                  {cap.chips.map((ch) => (
                    <span key={ch.t} className="inline-flex items-center gap-1.5 text-[11.5px] px-3 py-1.5 rounded-full hairline bg-panel2 text-fog">
                      <ch.icon size={12} className="text-sage-deep" /> {ch.t}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* design system */}
      <section id="design" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7 }}>
            <span className="inline-flex items-center gap-2 chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em]">Design system</span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-[-0.03em] mt-5 leading-[1.05]">
              Quiet paper,<br /> loud stories.
            </h2>
            <p className="text-fog mt-6 leading-relaxed text-[15px]">
              Every deck obeys a strict visual contract — 16:9 cinematic canvas at 1280×720, a 64px optical grid,
              hairline structure, sage health language, and two typographic voices: Inter Tight for headlines,
              Inter for everything that carries a thought.
            </p>
            <div className="grid grid-cols-5 gap-3 mt-8">
              {[
                { hex: '#f4f4ef', name: 'paper' },
                { hex: '#ffffff', name: 'surface' },
                { hex: '#17170f', name: 'ink' },
                { hex: '#d9f26b', name: 'lime' },
                { hex: '#9db494', name: 'sage' },
              ].map((c) => (
                <div key={c.hex} className="glass rounded-xl p-2.5 bg-white">
                  <div className="h-10 rounded-lg hairline" style={{ background: c.hex }} />
                  <p className="font-mono text-[9px] text-fog mt-2">{c.name}</p>
                  <p className="font-mono text-[9px] text-fog/60">{c.hex}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="glass rounded-3xl p-8 noise bg-white"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-fog mb-6">Type specimen</p>
            <div className="flex flex-col gap-6">
              <div className="border-b border-line pb-5">
                <p className="font-display font-semibold tracking-[-0.02em] text-4xl">Experience in motion</p>
                <p className="text-[10px] font-mono text-fog mt-1.5 tracking-wider">INTER TIGHT — HEADLINES</p>
              </div>
              <div className="border-b border-line pb-5">
                <p className="font-body text-2xl">Every section earns its place</p>
                <p className="text-[10px] font-mono text-fog mt-1.5 tracking-wider">INTER — BODY & UI</p>
              </div>
              <div>
                <p className="font-mono text-xl">01 — url → analysis → deck</p>
                <p className="text-[10px] font-mono text-fog mt-1.5 tracking-wider">JETBRAINS MONO — DATA & STEPS</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* final cta */}
      <section className="max-w-3xl mx-auto px-6 pb-28 pt-8 text-center">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <h2 className="font-display text-4xl md:text-[56px] font-semibold tracking-[-0.03em] leading-[1.03]">
            Give us a URL.<br />
            <span className="text-grad">Take the room.</span>
          </h2>
          <div className="mt-10 max-w-xl mx-auto">
            <UrlStudyForm compact />
          </div>
        </motion.div>
      </section>

      {/* export band + footer */}
      <FooterSection />
    </div>
  );
}
