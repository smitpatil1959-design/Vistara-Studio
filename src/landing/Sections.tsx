import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, Crosshair, Globe, MessageSquareText, Radar, Route, Sparkles, Target, FileText,
} from 'lucide-react';

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

/* ================================================== HOW VISTARA WORKS */

const STEPS = [
  {
    n: '01',
    icon: Globe,
    title: 'Start with the source',
    desc: 'Paste any URL. Vistara walks the live site — pages, media, links, copy and design tokens. Not a screenshot; the real thing.',
    visual: (
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl hairline bg-panel2 px-3.5 py-2.5">
          <Globe size={12} className="text-fog shrink-0" />
          <span className="font-mono text-[11.5px] text-ink/80 truncate">linear.app</span>
          <span className="ml-auto chip-lime rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold shrink-0">LIVE</span>
        </div>
        {['/features', '/method', '/pricing'].map((p, i) => (
          <div key={p} className="flex items-center gap-2.5 rounded-lg hairline bg-white px-3.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-deep" />
            <span className="font-mono text-[11px] text-fog">{p}</span>
            <span className="ml-auto font-mono text-[10px] text-fog/60">{[412, 388, 355][i]} ms</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '02',
    icon: Radar,
    title: 'Vistara finds the story',
    desc: 'The audit separates cosmetic issues from strategic ones. The brief names the audience, the proof, and the highest-leverage opportunity.',
    visual: (
      <div className="mt-6 flex flex-col gap-2">
        {[
          { k: 'Positioning clarity', v: '92', d: '+8' },
          { k: 'Trust & evidence', v: '67', d: '+14' },
          { k: 'Conversion flow', v: '74', d: '+11' },
        ].map((m) => (
          <div key={m.k} className="flex items-center gap-3 rounded-lg hairline bg-panel2 px-3.5 py-2">
            <span className="text-[11.5px] text-ink/80 flex-1 truncate">{m.k}</span>
            <span className="font-mono text-[11px] text-fog">{m.v}</span>
            <span className="chip-lime rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold">{m.d}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '03',
    icon: FileText,
    title: 'Present what matters',
    desc: 'Eleven sections composed on a cinematic canvas. Edit by hand or by sentence, then present, export to PDF, or share a link.',
    visual: (
      <div className="mt-6">
        <div className="rounded-xl hairline bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-fog">Generated deck</span>
            <span className="chip-lime rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold">11 sections</span>
          </div>
          <div className="mt-3 h-2 w-3/4 rounded-full bg-ink/85" />
          <div className="mt-2 h-1.5 w-1/2 rounded-full bg-black/15" />
          <div className="mt-4 flex flex-col gap-1.5">
            {[92, 78, 84].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-lime-deep shrink-0" />
                <span className="h-1.5 rounded-full bg-black/10" style={{ width: `${w * 0.6}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <motion.div {...rise()} className="text-center">
        <SectionPill>How Vistara works</SectionPill>
        <h2 className="font-display text-4xl md:text-[56px] font-semibold tracking-[-0.03em] mt-5 leading-[1.02] max-w-2xl mx-auto">
          From live website to clear investment story.
        </h2>
        <p className="text-fog max-w-xl mx-auto mt-5 leading-relaxed text-[15px]">
          Three passes over the same website. Nothing staged, nothing imagined — every claim on the deck comes from the crawl.
        </p>
      </motion.div>

      <div className="relative mt-14">
        <div className="absolute top-0 left-[8%] right-[8%] h-px bg-black/[0.08] hidden lg:block" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} {...rise(i * 0.08 + 0.05)} className="glass rounded-2xl p-7 bg-white card-hover relative">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-lime-soft hairline flex items-center justify-center">
                  <s.icon size={17} className="text-lime-deep" />
                </span>
                <span className="chip-lime rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold">{s.n}</span>
              </div>
              <h3 className="font-display font-semibold mt-5 text-[18px] tracking-[-0.01em]">{s.title}</h3>
              <p className="text-fog text-[13.5px] leading-relaxed mt-2">{s.desc}</p>
              {s.visual}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================== WEBSITE AUDIT */

const AUDIT_METRICS = [
  { label: 'Positioning clarity', score: 92, delta: '+8' },
  { label: 'Information hierarchy', score: 81, delta: '+4' },
  { label: 'Trust & evidence', score: 67, delta: '+14' },
  { label: 'Conversion flow', score: 74, delta: '+11' },
];

const AUDIT_CHECKS = [
  { title: 'Message clarity', sub: 'Does the first screen say who it is for and why it matters' },
  { title: 'Conversion logic', sub: 'Every section earns the next click toward one action' },
  { title: 'Design coherence', sub: 'Type, spacing and motion behaving as one system' },
];

function DarkAuditCard() {
  const R = 64;
  const C = 2 * Math.PI * R;
  const score = 86;
  return (
    <div className="rounded-[28px] bg-[#17170f] text-[#f4f4ef] p-6 md:p-8 shadow-[0_48px_100px_-40px_rgba(23,23,15,0.55)] relative overflow-hidden">
      {/* subtle top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div
        className="absolute -top-24 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.14), transparent)', filter: 'blur(30px)' }}
      />

      {/* header */}
      <div className="flex items-center gap-2.5 relative">
        <Radar size={16} className="text-[#d9f26b]" />
        <span className="text-[13.5px] font-medium">Website audit</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-mono text-[#f4f4ef]/55">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d9f26b] animate-pulse-soft" />
          Completed in 22 sec
        </span>
      </div>

      {/* body */}
      <div className="grid grid-cols-[auto_1fr] gap-6 md:gap-10 items-center mt-8 relative">
        {/* ring */}
        <div className="relative w-[150px] h-[150px] md:w-[170px] md:h-[170px]">
          <svg viewBox="0 0 170 170" className="w-full h-full -rotate-90">
            <circle cx="85" cy="85" r={R} stroke="rgba(244,244,239,0.08)" strokeWidth="10" fill="none" />
            <motion.circle
              cx="85"
              cy="85"
              r={R}
              stroke="#d9f26b"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              whileInView={{ strokeDashoffset: C * (1 - score / 100) }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-semibold text-5xl tracking-tight">86</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-[#f4f4ef]/50 mt-1">Site health</span>
          </div>
        </div>

        {/* metrics */}
        <div className="flex flex-col divide-y divide-white/[0.09]">
          {AUDIT_METRICS.map((m, i) => {
            const leverage = m.label === 'Trust & evidence';
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.09 }}
                className={`flex items-center gap-4 py-3.5 px-2 -mx-2 rounded-xl transition-colors ${leverage ? 'bg-[#d9f26b]/[0.07] border border-[#d9f26b]/15 shadow-[0_0_32px_-8px_rgba(217,242,107,0.35)]' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${leverage ? 'bg-[#d9f26b]' : 'bg-white/20'}`} />
                <span className={`text-[13px] flex-1 truncate ${leverage ? 'text-[#f4f4ef]' : 'text-[#f4f4ef]/75'}`}>{m.label}</span>
                <span className="font-mono text-[13px] text-[#f4f4ef]/90">{m.score}</span>
                <span className="bg-[#d9f26b] text-[#42570a] rounded-full px-2.5 py-1 text-[11px] font-mono font-semibold min-w-[38px] text-center">
                  {m.delta}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* opportunity */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, delay: 0.55 }}
        className="mt-7 rounded-2xl bg-white/[0.05] border border-white/10 p-5 flex gap-4 items-start relative"
      >
        <span className="w-9 h-9 rounded-xl bg-[#d9f26b] flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-[#17170f]" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold">Highest-leverage opportunity</p>
          <p className="text-[12.5px] text-[#f4f4ef]/55 leading-relaxed mt-1">
            Move customer outcomes above feature depth. The evidence is strong; the current sequence hides it.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function AuditSection() {
  return (
    <section id="audit" className="max-w-6xl mx-auto px-6 py-24 border-t border-line">
      <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-12 lg:gap-16 items-center">
        {/* left copy */}
        <motion.div {...rise()}>
          <span className="inline-flex items-center rounded-full bg-white hairline px-4 py-1.5 text-[11.5px] font-medium text-ink/80">
            Website audit
          </span>
          <h2 className="font-serif text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.01em] mt-6">
            A diagnosis,<br /> not a <span className="italic">scorecard.</span>
          </h2>
          <p className="text-fog mt-6 leading-relaxed text-[15px] max-w-md">
            Vistara separates cosmetic issues from strategic ones. It shows where the site loses clarity,
            momentum — and what to fix first.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <a href="#new-study" className="btn-grad rounded-xl px-5 py-3 text-sm font-semibold">
              Get an audit
            </a>
            <Link
              to="/gallery"
              className="btn-quiet rounded-xl px-5 py-3 text-sm font-medium"
            >
              See sample
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mt-12 pt-8 border-t border-line">
            {AUDIT_CHECKS.map((c, i) => (
              <motion.div key={c.title} {...rise(0.1 + i * 0.07)}>
                <span className="w-6 h-6 rounded-full border border-sage-deep/40 bg-white flex items-center justify-center">
                  <CheckCircle2 size={13} className="text-sage-deep" />
                </span>
                <p className="text-[13px] font-semibold mt-2.5">{c.title}</p>
                <p className="text-[11.5px] text-fog leading-relaxed mt-1">{c.sub}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* right: dark audit card */}
        <motion.div {...rise(0.12)}>
          <DarkAuditCard />
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================== AI UNDERSTANDING */

const CONTEXT_CHIPS = [
  { label: 'Developer Tool', kind: 'cat' },
  { label: 'Engineering teams', kind: 'aud' },
  { label: 'Product leads', kind: 'aud' },
  { label: 'Founders', kind: 'aud' },
  { label: 'Refined tone', kind: 'tone' },
];

function ConcentricRings() {
  return (
    <div className="absolute -right-24 -top-24 w-[420px] h-[420px] pointer-events-none select-none" aria-hidden>
      <svg viewBox="0 0 420 420" className="ring-rotor w-full h-full" style={{ transformOrigin: '50% 50%' }}>
        <circle cx="210" cy="210" r="200" fill="none" stroke="rgba(23,23,15,0.10)" strokeWidth="1" strokeDasharray="3 7" />
        <circle cx="210" cy="210" r="150" fill="none" stroke="rgba(157,180,148,0.5)" strokeWidth="1" strokeDasharray="14 10" />
        <circle cx="210" cy="210" r="200" fill="none" stroke="rgba(66,87,10,0.35)" strokeWidth="8" strokeLinecap="round" strokeDasharray="80 1180" />
      </svg>
      <svg viewBox="0 0 420 420" className="ring-rotor-rev absolute inset-0 w-full h-full" style={{ transformOrigin: '50% 50%' }}>
        <circle cx="210" cy="210" r="102" fill="none" stroke="rgba(23,23,15,0.14)" strokeWidth="1" />
        <circle cx="210" cy="210" r="102" fill="none" stroke="#d9f26b" strokeWidth="6" strokeLinecap="round" strokeDasharray="52 600" />
        <circle cx="210" cy="210" r="56" fill="none" stroke="rgba(157,180,148,0.6)" strokeWidth="1" strokeDasharray="2 6" />
      </svg>
    </div>
  );
}

export function UnderstandingSection() {
  return (
    <section id="understanding" className="max-w-6xl mx-auto px-6 py-24 border-t border-line overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* context card with rings */}
        <motion.div {...rise(0.1)} className="relative order-2 lg:order-1">
          <ConcentricRings />
          <div className="glass rounded-3xl bg-white p-7 md:p-8 relative noise">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl chip-lime flex items-center justify-center">
                <Target size={16} />
              </span>
              <div>
                <p className="font-display font-semibold text-[15px]">Context extracted</p>
                <p className="text-[10px] font-mono text-fog uppercase tracking-[0.2em]">linear.app · 5 pages · 12 links</p>
              </div>
              <span className="ml-auto chip-lime rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold">BRIEF</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              {CONTEXT_CHIPS.map((c) => (
                <span
                  key={c.label}
                  className={`text-[11.5px] px-3 py-1.5 rounded-full hairline ${c.kind === 'cat' ? 'bg-lime-soft text-lime-deep font-medium' : 'bg-panel2 text-ink/75'}`}
                >
                  {c.label}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-lime-soft border border-lime-deep/15 p-5 relative">
              <span className="absolute -top-2 left-5 chip-lime rounded px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-[0.18em]">Thesis</span>
              <p className="text-[14.5px] font-display font-medium leading-relaxed text-ink/85 italic">
                “A calm, keyboard-first system wins on flow state, not feature count. Lead with the 2× velocity
                proof; let the methodology carry the close.”
              </p>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] font-mono text-fog mb-2">
                <span className="uppercase tracking-[0.2em]">Thesis confidence</span>
                <span className="text-lime-deep font-semibold">94%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/[0.07] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '94%' }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #9db494, #d9f26b)' }}
                />
              </div>
              <p className="text-[10.5px] font-mono text-fog/70 mt-2">Cross-checked against 12 signals from the live site</p>
            </div>
          </div>
        </motion.div>

        {/* right copy */}
        <motion.div {...rise(0.05)} className="order-1 lg:order-2">
          <SectionPill>AI understanding</SectionPill>
          <h2 className="font-display text-4xl md:text-[52px] font-semibold tracking-[-0.03em] mt-5 leading-[1.04]">
            It understands the business <span className="font-serif italic font-normal text-grad">behind the pixels.</span>
          </h2>
          <p className="text-fog mt-6 leading-relaxed text-[15px] max-w-md">
            Headings, pricing pages and footers say more than they admit. Vistara reads the whole surface and
            writes the brief a strategist would: who it is for, why it wins, and what to say first.
          </p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {[
              { icon: MessageSquareText, t: 'Audience and tone named in plain language' },
              { icon: Route, t: 'The argument order your deck should follow' },
              { icon: Crosshair, t: 'The one claim to lead the cover with' },
            ].map((row, i) => (
              <motion.li key={row.t} {...rise(0.12 + i * 0.07)} className="flex items-center gap-3 text-[13.5px] text-ink/80">
                <span className="w-7 h-7 rounded-lg bg-white hairline flex items-center justify-center shrink-0">
                  <row.icon size={13} className="text-lime-deep" />
                </span>
                {row.t}
              </motion.li>
            ))}
          </ul>
          <a href="#new-study" className="inline-flex items-center gap-2 text-[13.5px] font-medium text-lime-deep hover:text-ink transition-colors mt-9">
            Run it on your own site <ArrowRight size={14} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
