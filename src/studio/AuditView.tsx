import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Accessibility, ArrowRight, CheckCircle2, Gauge, Info, Lightbulb, Link2, ListChecks,
  Lock, MousePointerClick as MouseIcon, ScanSearch, Smartphone, Sparkles, TriangleAlert, XCircle,
} from 'lucide-react';
import type { Audit, AuditFinding, FindingSeverity } from '../types';
import { ScoreRing } from '../components/ui';

const CAT_ICONS: Record<string, React.ElementType> = {
  technical: Link2,
  performance: Gauge,
  accessibility: Accessibility,
  mobile: Smartphone,
  ux: MouseIcon,
  security: Lock,
};

const SEV_STYLE: Record<FindingSeverity, { chip: string; icon: React.ElementType; ring: string }> = {
  critical: { chip: 'bg-[#f9e3e0] text-[#a2403a] border-[#ecc5c0]', icon: XCircle, ring: '#c4574e' },
  warning: { chip: 'bg-[#faf1d6] text-[#8a6d1c] border-[#e8d5a4]', icon: TriangleAlert, ring: '#c99e2e' },
  suggestion: { chip: 'bg-[#e5edfb] text-[#2b5fae] border-[#c9d8f2]', icon: Lightbulb, ring: '#2b5fae' },
  pass: { chip: 'bg-[#e7efe2] text-sage-deep border-[#c4d4bb]', icon: CheckCircle2, ring: '#6f9463' },
};

const catBar = (score: number) =>
  score >= 90 ? 'linear-gradient(90deg,#9db494,#6f9463)' : score >= 75 ? 'linear-gradient(90deg,#d2f08a,#9db834)' : score >= 60 ? 'linear-gradient(90deg,#ecd27a,#c99e2e)' : 'linear-gradient(90deg,#e8a7a0,#c4574e)';

/* ------------------------------------------------ AI summary (rules only) */

function buildSummary(audit: Audit) {
  const findings = audit.categories.flatMap((c) => c.findings);

  const criticals = findings.filter((f) => f.severity === 'critical');
  const warnings = findings.filter((f) => f.severity === 'warning');

  const foundLines = [
    `${findings.length} checks executed against a real ${audit.engine === 'rendered-browser' ? 'browser render' : 'document capture'} — ${audit.counts?.pass ?? 0} passed clean.`,
    ...(audit.vitals
      ? [
          `Measured LCP ${audit.vitals.lcpMs != null ? Math.round(audit.vitals.lcpMs) + ' ms' : 'n/a'} · CLS ${audit.vitals.cls} · interactions ${audit.vitals.inpMs != null ? 'p75 ' + Math.round(audit.vitals.inpMs) + ' ms' : 'not sampled'} · ${audit.vitals.longtasks} long tasks.`,
        ]
      : []),
    ...(audit.viewports?.length ? [`Geometry swept on ${audit.viewports.map((v) => v.name.toLowerCase()).join('/')}: ${audit.viewports.reduce((s, v) => s + v.horizontalOverflowPx, 0)}px total overflow.`] : []),
    ...criticals.slice(0, 3).map((f) => `Critical: ${f.title.toLowerCase()}.`),
  ];

  const working = findings
    .filter((f) => f.severity === 'pass' && f.evidence)
    .slice(0, 14)
    .sort((a, b) => (b.evidence.length > a.evidence.length ? -1 : 1))
    .slice(0, 5)
    .map((f) => `${f.title} (${f.evidence.slice(0, 80)})`);

  const fixFirst = findBestFixes(criticals, warnings);

  const weakest = [...audit.categories].sort((a, b) => a.score - b.score)[0];
  const nextSteps = [
    weakest ? `Attack ${weakest.label.toLowerCase()} first — it's the lowest measured axis (${weakest.score}/100).` : 'Re-run the scan after the first fix lands.',
    ...fixFirst.slice(0, 2).map((f) => f.recommendation).filter(Boolean),
    'Re-run the analysis to confirm the fixes land — then regenerate the deck.',
  ];

  return { foundLines, working, fixFirst, nextSteps };
}

function findBestFixes(criticals: AuditFinding[], warnings: AuditFinding[]): AuditFinding[] {
  return [...criticals, ...warnings].slice(0, 5);
}

/* ------------------------------------------------ summary panel */

function SummaryCard({ icon: Icon, title, children, delay = 0 }: { icon: React.ElementType; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl p-5 bg-white"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg chip-lime flex items-center justify-center shrink-0">
          <Icon size={14} />
        </span>
        <h3 className="font-display font-semibold text-[14.5px]">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function AiSummary({ audit }: { audit: Audit }) {
  const s = useMemo(() => buildSummary(audit), [audit]);
  return (
    <section className="relative overflow-hidden rounded-3xl hairline bg-white p-6 md:p-8 mb-5 noise">
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.32), transparent)', filter: 'blur(28px)' }} />
      <div className="flex items-center gap-2.5 mb-5 relative">
        <Sparkles size={16} className="text-lime-deep" />
        <h2 className="font-display text-xl font-semibold tracking-tight">AI summary</h2>
        <span className="ml-auto text-[9.5px] font-mono uppercase tracking-[0.18em] text-fog bg-panel2 hairline rounded-full px-3 py-1">
          compiled from measured findings only
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4 relative">
        <SummaryCard icon={ScanSearch} title="What Vistara found" delay={0.05}>
          <ul className="flex flex-col gap-2">
            {s.foundLines.map((l, i) => (
              <li key={i} className="text-[12.5px] text-ink/80 leading-relaxed flex gap-2">
                <span className="w-1 h-1 rounded-full bg-ink mt-[7px] shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </SummaryCard>
        <SummaryCard icon={CheckCircle2} title="What's working well" delay={0.1}>
          <ul className="flex flex-col gap-2">
            {s.working.length === 0 && <li className="text-[12.5px] text-fog">No passing checks to celebrate yet — the findings list is honest about that.</li>}
            {s.working.map((l, i) => (
              <li key={i} className="text-[12.5px] text-ink/80 leading-relaxed flex gap-2">
                <CheckCircle2 size={12} className="text-sage-deep mt-0.5 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </SummaryCard>
        <SummaryCard icon={TriangleAlert} title="What should be fixed first" delay={0.15}>
          <ul className="flex flex-col gap-2.5">
            {s.fixFirst.length === 0 && <li className="text-[12.5px] text-sage-deep">Nothing critical or warning-level. Suggestions remain below.</li>}
            {s.fixFirst.map((f, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed">
                <span className={`inline-flex text-[9px] font-mono font-semibold uppercase tracking-[0.14em] rounded-full px-2 py-0.5 border mr-2 ${SEV_STYLE[f.severity].chip}`}>
                  {f.severity}
                </span>
                <span className="text-ink/85 font-medium">{f.title}</span>
                {f.recommendation && <span className="block text-fog mt-1 pl-0.5">{f.recommendation}</span>}
              </li>
            ))}
          </ul>
        </SummaryCard>
        <SummaryCard icon={ListChecks} title="Recommended next steps" delay={0.2}>
          <ol className="flex flex-col gap-2">
            {s.nextSteps.map((l, i) => (
              <li key={i} className="text-[12.5px] text-ink/80 leading-relaxed flex gap-2.5">
                <span className="w-5 h-5 rounded-full chip-lime flex items-center justify-center text-[10px] font-mono font-semibold shrink-0">{i + 1}</span>
                {l}
              </li>
            ))}
          </ol>
        </SummaryCard>
      </div>
    </section>
  );
}

/* ------------------------------------------------ issue card */

function IssueCard({ f, delay }: { f: AuditFinding; delay: number }) {
  const meta = SEV_STYLE[f.severity];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`glass rounded-2xl p-5 bg-white ${f.severity === 'pass' ? 'opacity-90' : ''}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] rounded-full px-2.5 py-1 border ${meta.chip}`}>
          <meta.icon size={10} />
          {f.severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-fog">{f.category}</span>
        <span className="text-[9.5px] font-mono text-fog/50 ml-auto">{f.id}</span>
      </div>
      <h4 className="font-display font-semibold text-[15px] mt-3 leading-snug">{f.title}</h4>
      <p className="text-[12.5px] text-fog mt-1.5 leading-relaxed">{f.explanation}</p>
      {f.evidence && (
        <div className="mt-3 rounded-xl bg-panel2 hairline px-3.5 py-2.5">
          <p className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-fog/70 mb-1">evidence · measured</p>
          <p className="text-[11px] font-mono text-ink/70 break-words leading-relaxed">{f.evidence}</p>
        </div>
      )}
      {f.recommendation && (
        <p className="text-[12px] text-sage-deep mt-3 flex items-start gap-1.5 leading-relaxed">
          <ArrowRight size={11} className="mt-1 shrink-0" />
          {f.recommendation}
        </p>
      )}
    </motion.article>
  );
}

/* ------------------------------------------------ main dashboard */

export default function AuditView({ audit }: { audit: Audit }) {
  const [sev, setSev] = useState<'all' | 'critical' | 'warning' | 'suggestion'>('all');
  const [cat, setCat] = useState<string>('all');

  if (!audit || !audit.categories?.length) {
    return (
      <div className="glass rounded-3xl bg-white p-12 text-center">
        <Gauge size={22} className="text-fog mx-auto mb-4" />
        <h3 className="font-display font-semibold text-lg">No audit recorded yet</h3>
        <p className="text-fog text-sm mt-2">Run the analysis to produce a measured health report.</p>
      </div>
    );
  }

  const counts = audit.counts || { critical: 0, warning: 0, suggestion: 0, pass: 0 };
  const all = audit.categories.flatMap((c) => c.findings);
  const visible = all.filter((f) => (sev === 'all' ? f.severity !== 'pass' || true : f.severity === sev) && (cat === 'all' || f.category === cat));

  const grade = audit.grade ?? (audit.overall >= 90 ? 'A' : audit.overall >= 80 ? 'B' : audit.overall >= 68 ? 'C' : audit.overall >= 55 ? 'D' : 'F');

  return (
    <div className="pb-10">
      {/* hero score block */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="rounded-3xl hairline bg-white p-8 md:p-10 mb-5 relative overflow-hidden noise">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.4), transparent 80%)', filter: 'blur(40px)' }} />
        <div className="flex flex-col md:flex-row items-center gap-9 relative">
          <div className="relative">
            <ScoreRing score={audit.overall} size={176} stroke={12} label="Health" />
            <span className="absolute -bottom-1 -right-2 w-11 h-11 rounded-full bg-ink text-lime flex items-center justify-center font-display font-semibold text-lg shadow-lg">
              {grade}
            </span>
          </div>
          <div className="text-center md:text-left min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.26em] text-lime-deep">Website health report</p>
            <h2 className="font-display text-3xl md:text-[40px] font-semibold tracking-[-0.02em] mt-3 leading-tight">{audit.verdict}</h2>
            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start text-[11px] font-mono">
              <span className="rounded-full px-3 py-1.5 border bg-[#f9e3e0]/70 border-[#ecc5c0] text-[#a2403a]">{counts.critical} critical</span>
              <span className="rounded-full px-3 py-1.5 border bg-[#faf1d6]/70 border-[#e8d5a4] text-[#8a6d1c]">{counts.warning} warnings</span>
              <span className="rounded-full px-3 py-1.5 border bg-[#e5edfb]/70 border-[#c9d8f2] text-[#2b5fae]">{counts.suggestion} suggestions</span>
              <span className="rounded-full px-3 py-1.5 border bg-white border-line text-sage-deep">{counts.pass} passed</span>
            </div>
            <p className="text-[11px] font-mono text-fog/70 mt-4 uppercase tracking-wider">
              {audit.engine === 'rendered-browser' ? 'Rendered browser capture' : 'Document capture'} · every score from measured data · {new Date(audit.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="md:ml-auto grid grid-cols-2 gap-2.5 w-full md:w-[300px]">
            {audit.categories.map((c) => (
              <div key={c.key} className="rounded-xl hairline bg-panel2 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-fog truncate">{c.label}</span>
                  <span className="font-display font-semibold text-[14px]" style={{ color: c.score >= 90 ? '#4f6b4a' : c.score >= 60 ? '#7a641c' : '#a2403a' }}>
                    {c.score}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-black/[0.07] mt-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.score}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{ background: catBar(c.score) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* AI summary */}
      <AiSummary audit={audit} />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mr-1">Severity</span>
        {(
          [
            ['all', `All · ${all.length}`],
            ['critical', `Critical · ${counts.critical}`],
            ['warning', `Warnings · ${counts.warning}`],
            ['suggestion', `Suggestions · ${counts.suggestion}`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setSev(k)} className={`rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-all ${sev === k ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mr-1">Category</span>
        <button onClick={() => setCat('all')} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${cat === 'all' ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}>
          All
        </button>
        {audit.categories.map((c) => {
          const Icon = CAT_ICONS[c.key] || Gauge;
          return (
            <button key={c.key} onClick={() => setCat(cat === c.key ? 'all' : c.key)} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all flex items-center gap-1.5 ${cat === c.key ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}>
              <Icon size={11} /> {c.label} · {c.findings.length}
            </button>
          );
        })}
      </div>

      {/* issue cards */}
      {visible.length === 0 ? (
        <div className="glass rounded-3xl bg-white p-12 text-center">
          <CheckCircle2 size={22} className="text-sage-deep mx-auto mb-4" />
          <h3 className="font-display font-semibold text-lg">Nothing in this bucket</h3>
          <p className="text-fog text-sm mt-2">Change filters to browse the rest of the findings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((f, i) => (
            <IssueCard key={`${f.id}-${i}`} f={f} delay={Math.min(i, 10) * 0.03} />
          ))}
        </div>
      )}

      <p className="text-[10.5px] font-mono text-fog/60 mt-6 text-center uppercase tracking-[0.18em] flex items-center justify-center gap-2">
        <Info size={10} /> Measured at source · nothing simulated · scores penalize only what was proven
      </p>
    </div>
  );
}
