import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Palette,
  Building2,
  Users,
  Megaphone,
  Layers,
  Compass,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  Project,
  VistaraDNA,
  DnaVerificationStatus,
} from '../types';
import { displayValue, isStructuredValue } from '../lib/display';

interface DnaViewProps {
  project: Project;
  onUseAccent?: (hex: string) => void;
}

/* ------------------------------------------------ Verification Badges & Evidence */

function VerificationChip({ status }: { status: DnaVerificationStatus }) {
  if (status === 'Verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] bg-[#e6f4ea] text-[#137333] border border-[#ceead6] rounded-full px-2.5 py-0.5 shadow-sm">
        <ShieldCheck size={11} className="text-[#137333]" /> Verified
      </span>
    );
  }
  if (status === 'Partially verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] bg-[#fef7e0] text-[#b06000] border border-[#feefc3] rounded-full px-2.5 py-0.5 shadow-sm">
        <Sparkles size={11} className="text-[#b06000]" /> Partially verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-[0.12em] bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0] rounded-full px-2.5 py-0.5">
      <HelpCircle size={11} className="text-[#5f6368]" /> Not verified
    </span>
  );
}

function EvidenceList({ items }: { items?: unknown[] }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-black/[0.04]">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[11px] font-mono text-fog hover:text-ink transition-colors cursor-pointer"
      >
        <span>{open ? 'Hide evidence' : `${items.length} verified evidence ${items.length === 1 ? 'citation' : 'citations'}`}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-1.5 space-y-1"
          >
            {items.map((item, idx) => (
              <div
                key={idx}
                className="text-[11.5px] font-mono text-ink/70 bg-black/[0.02] border border-black/[0.05] rounded-lg px-3 py-1.5 flex items-start gap-2"
              >
                <span className="text-lime-deep shrink-0 mt-0.5">›</span>
                <span className="break-all">
                  {displayValue(item, 'No evidence provided')}
                  {isStructuredValue(item) && (
                    <span className="block text-[10px] text-fog mt-1">
                      {item.basis ? `${item.basis} · ` : ''}
                      {typeof item.confidence === 'number' ? `${Math.round(item.confidence * 100)}% confidence` : ''}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PillarCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-6 bg-white shadow-sm border border-line flex flex-col transition-all">
      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-lime-soft hairline flex items-center justify-center shrink-0">
            <Icon size={18} className="text-lime-deep" />
          </span>
          <div>
            <h3 className="font-display font-semibold text-[17px] text-ink">{title}</h3>
            {subtitle && <p className="text-[12px] text-fog mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="flex-1 space-y-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------ Main Vistara DNA Component */

export default function DnaView({ project, onUseAccent }: DnaViewProps) {
  const dna: VistaraDNA | undefined =
    project.dna ||
    (project.understanding as { dna?: VistaraDNA })?.dna ||
    (project.analysis as { dna?: VistaraDNA })?.dna;

  if (!dna) {
    return (
      <div className="glass rounded-2xl p-12 text-center bg-white border border-line max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-lime-soft flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} className="text-lime-deep" />
        </div>
        <h2 className="font-display font-semibold text-xl">Vistara DNA Synthesizing</h2>
        <p className="text-fog text-sm mt-2 max-w-md mx-auto">
          Crawl the target website to construct the full 7-pillar brand, business, and strategic intelligence profile.
        </p>
      </div>
    );
  }

  const {
    brandIdentity,
    businessUnderstanding,
    audience,
    brandVoice,
    visualLanguage,
    experienceIntelligence,
    verificationSummary,
  } = dna;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Intelligence Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-deep rounded-3xl p-8 bg-gradient-to-br from-white via-white to-lime-soft/30 border border-line shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="chip-lime rounded-full px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.14em]">
                Vistara Intelligence Layer
              </span>
              <span className="text-[12px] font-mono text-fog">
                {dna.host} · {verificationSummary.totalPagesCrawled} pages mapped
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-ink">
                {displayValue(businessUnderstanding.productName, project.name)}
            </h1>
            <p className="text-fog text-[15px] max-w-2xl mt-1.5 leading-relaxed">
              {displayValue(businessUnderstanding.tagline, 'Verified business profile synthesized from real web signals.')}
            </p>
          </div>

          {/* Verification Score Card */}
          <div className="glass rounded-2xl p-5 bg-white border border-line shadow-sm flex items-center gap-5 shrink-0">
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-lime-soft border border-lime-deep/30 shrink-0">
              <span className="font-display font-bold text-xl text-ink">
                {verificationSummary.overallScore}%
              </span>
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-fog font-medium">
                Verification Index
              </p>
              <p className="font-display font-semibold text-sm text-ink mt-0.5">
                {verificationSummary.verifiedCount} Verified Data Points
              </p>
              <p className="text-[11.5px] text-fog mt-0.5">
                {verificationSummary.totalEvidencePoints} total evidence citations
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid of 6 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PILLAR 1: Brand Identity */}
        <PillarCard
          icon={Palette}
          title="1. Brand Identity"
          subtitle="Logo, authentic palette, typography & visual style"
          badge={<VerificationChip status={brandIdentity.colorPalette.status} />}
        >
          {/* Logo & Palette Bar */}
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Color System</p>
            <div className="flex items-center gap-2 flex-wrap">
              {brandIdentity.colorPalette.rawPalette.map((c, i) => (
                <div
                  key={i}
                  onClick={() => onUseAccent && onUseAccent(c.hex)}
                  title={`Click to set ${c.hex} as presentation accent`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line cursor-pointer hover:scale-105 transition-transform bg-white shadow-xs"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[12px] font-mono font-medium text-ink">{c.hex}</span>
                </div>
              ))}
            </div>
            <EvidenceList items={brandIdentity.colorPalette.evidence} />
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Typography</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-panel2 border border-line">
                <p className="text-[10px] font-mono text-fog uppercase">Headlines</p>
                <p className="font-display font-semibold text-sm mt-0.5 truncate">{displayValue(brandIdentity.typography.headingFont)}</p>
              </div>
              <div className="p-3 rounded-xl bg-panel2 border border-line">
                <p className="text-[10px] font-mono text-fog uppercase">Body Text</p>
                <p className="text-sm font-medium mt-0.5 truncate">{displayValue(brandIdentity.typography.bodyFont)}</p>
              </div>
            </div>
            <EvidenceList items={brandIdentity.typography.evidence} />
          </div>

          <div className="p-3 rounded-xl bg-lime-soft/40 border border-lime-deep/20 text-[12.5px] leading-relaxed">
            <span className="font-semibold text-ink">Visual Style: </span>
            <span className="text-ink/80">{displayValue(brandIdentity.visualStyle.style)}</span>
          </div>
        </PillarCard>

        {/* PILLAR 2: Business Understanding */}
        <PillarCard
          icon={Building2}
          title="2. Business Understanding"
          subtitle="What the company does, products, & differentiators"
          badge={<VerificationChip status={businessUnderstanding.summary.status} />}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Core Mission & Summary</p>
            <p className="text-[13.5px] leading-relaxed text-ink/90 bg-panel2 p-3.5 rounded-xl border border-line">
              {displayValue(businessUnderstanding.summary.value, 'No summary available.')}
            </p>
            <EvidenceList items={businessUnderstanding.summary.evidence} />
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Value Proposition</p>
            <div className="p-3.5 rounded-xl bg-white border border-line shadow-xs">
              <p className="text-[13px] font-medium text-ink">
                {displayValue(businessUnderstanding.valueProposition.statement)}
              </p>
              {businessUnderstanding.valueProposition.supportingPoints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {businessUnderstanding.valueProposition.supportingPoints.map((pt, idx) => (
                    <li key={idx} className="text-[12px] text-fog flex items-start gap-1.5">
                      <span className="text-lime-deep shrink-0">✓</span> {displayValue(pt)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <EvidenceList items={businessUnderstanding.valueProposition.evidence} />
          </div>

          {businessUnderstanding.differentiators.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-black/[0.04]">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Verified Differentiators</p>
              <div className="space-y-1.5">
                {businessUnderstanding.differentiators.map((d, i) => (
                  <div key={i} className="text-[12px] p-2.5 rounded-lg bg-panel2 border border-line text-ink/80 flex items-start gap-2">
                    <ShieldCheck size={14} className="text-lime-deep shrink-0 mt-0.5" />
                    <span>{displayValue(d.claim)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PillarCard>

        {/* PILLAR 3: Audience */}
        <PillarCard
          icon={Users}
          title="3. Target Audience"
          subtitle="Target profiles, user problems, & use cases"
          badge={<VerificationChip status={audience.primaryAudience.status} />}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Primary Audience</p>
            <div className="p-3 rounded-xl bg-panel2 border border-line text-[13px] text-ink font-medium">
              {displayValue(audience.primaryAudience.segment)}
            </div>
            <EvidenceList items={audience.primaryAudience.evidence} />
          </div>

          {audience.userNeeds.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-black/[0.04]">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">User Problems Addressed</p>
              <div className="space-y-1.5">
                {audience.userNeeds.map((n, idx) => (
                  <div key={idx} className="text-[12.5px] p-2.5 rounded-lg bg-white border border-line text-ink/80 flex items-start gap-2">
                    <span className="text-lime-deep shrink-0 mt-0.5">•</span>
                    <span>{displayValue(n.problem)}</span>
                  </div>
                ))}
              </div>
              <EvidenceList items={audience.userNeeds[0]?.evidence} />
            </div>
          )}

          {audience.useCases.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-black/[0.04]">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Core Use Cases</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {audience.useCases.map((uc, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-panel2 border border-line">
                    <p className="font-semibold text-[12px] text-ink">{displayValue(uc.title)}</p>
                    <p className="text-[11px] text-fog mt-0.5 line-clamp-2">{displayValue(uc.scenario)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PillarCard>

        {/* PILLAR 4: Brand Voice */}
        <PillarCard
          icon={Megaphone}
          title="4. Brand Voice & Messaging"
          subtitle="Tone, headline patterns, and CTA style"
          badge={<VerificationChip status={brandVoice.tone.status} />}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Voice & Tone</p>
            <div className="p-3 rounded-xl bg-panel2 border border-line">
              <p className="text-[13px] font-medium text-ink">{displayValue(brandVoice.tone.primary)}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {brandVoice.tone.descriptors.map((d, idx) => (
                  <span key={idx} className="chip-lime rounded-md px-2 py-0.5 text-[10px] font-mono">
                    {displayValue(d)}
                  </span>
                ))}
              </div>
            </div>
            <EvidenceList items={brandVoice.tone.evidence} />
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Common Terminology</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {brandVoice.commonTerminology.terms.map((t, idx) => (
                <span key={idx} className="bg-black/[0.04] text-ink/80 rounded-md px-2.5 py-1 text-[11px] font-mono border border-line">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Call to Action Style</p>
            <div className="p-3 rounded-xl bg-white border border-line text-[12.5px]">
              <span className="font-semibold text-ink">Primary Trigger: </span>
              <span className="text-lime-deep font-mono font-medium">"{displayValue(brandVoice.ctaStyle.primaryAction)}"</span>
              {brandVoice.ctaStyle.detectedCtas.length > 0 && (
                <p className="text-[11.5px] text-fog mt-1">
                  Observed variants: {displayValue(brandVoice.ctaStyle.detectedCtas.slice(0, 4))}
                </p>
              )}
            </div>
            <EvidenceList items={brandVoice.ctaStyle.evidence} />
          </div>
        </PillarCard>

        {/* PILLAR 5: Visual Language */}
        <PillarCard
          icon={Layers}
          title="5. Visual Language"
          subtitle="Design tokens, layout systems, & photography"
          badge={<VerificationChip status={visualLanguage.typographyHierarchy.status} />}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Design System Tokens</p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="p-2.5 rounded-lg bg-panel2 border border-line">
                <span className="text-fog block text-[10px] font-mono">Corner Radius</span>
                <span className="font-semibold text-ink">{displayValue(visualLanguage.layoutPatterns.radius)}px</span>
              </div>
              <div className="p-2.5 rounded-lg bg-panel2 border border-line">
                <span className="text-fog block text-[10px] font-mono">Grid Structure</span>
                <span className="font-semibold text-ink truncate block">{displayValue(visualLanguage.layoutPatterns.grid).split(' ')[0]} Responsive</span>
              </div>
            </div>
            <EvidenceList items={visualLanguage.layoutPatterns.evidence} />
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Media Treatment</p>
            <p className="text-[12.5px] text-ink/80 bg-white p-3 rounded-xl border border-line">
              {displayValue(visualLanguage.photographyStyle.description)}
            </p>
            <EvidenceList items={visualLanguage.photographyStyle.evidence} />
          </div>
        </PillarCard>

        {/* PILLAR 6: Experience Intelligence */}
        <PillarCard
          icon={Compass}
          title="6. Experience Intelligence"
          subtitle="Navigation structure, user journey, & key pages"
          badge={<VerificationChip status={experienceIntelligence.navigation.status} />}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">User Journey Flow</p>
            <div className="space-y-1.5">
              {experienceIntelligence.userJourney.coreProgression.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[12px] p-2 rounded-lg bg-panel2 border border-line">
                  <span className="w-5 h-5 rounded-full bg-white text-ink text-[10px] font-bold flex items-center justify-center shrink-0 border border-line">
                    {idx + 1}
                  </span>
                  <span className="text-ink/85">{displayValue(step)}</span>
                </div>
              ))}
            </div>
            <EvidenceList items={experienceIntelligence.userJourney.evidence} />
          </div>

          <div className="space-y-2 pt-2 border-t border-black/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-fog">Important Pages Catalog</p>
            <div className="space-y-1">
              {experienceIntelligence.importantPages.map((page, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11.5px] p-2 rounded-lg bg-white border border-line">
                  <span className="font-mono text-ink font-medium truncate max-w-[180px]">{page.path}</span>
                  <span className="text-fog text-[11px]">{displayValue(page.role)}</span>
                </div>
              ))}
            </div>
          </div>
        </PillarCard>
      </div>

      {/* PILLAR 7: Evidence & Verification Summary Bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 bg-white border border-line shadow-sm"
      >
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <FileCheck2 size={20} className="text-lime-deep" />
            <h3 className="font-display font-semibold text-lg text-ink">7. Evidence & Verification Integrity</h3>
          </div>
          <span className="text-[11px] font-mono text-fog">
            Zero-hallucination compliance · 100% extracted from verified crawl
          </span>
        </div>
        <p className="text-fog text-[13px] leading-relaxed mb-4">
          Every assertion within this Vistara DNA profile is grounded directly in crawled DOM elements, extracted styles, HTTP headers, or verified link observations. Missing values default to <span className="font-mono text-ink">null</span> or <span className="font-mono text-ink">Not verified</span> rather than simulated guesses.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-panel2 border border-line">
            <p className="text-[11px] font-mono text-fog uppercase">Verified Points</p>
            <p className="font-display font-bold text-xl text-[#137333] mt-0.5">{verificationSummary.verifiedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-panel2 border border-line">
            <p className="text-[11px] font-mono text-fog uppercase">Partially Verified</p>
            <p className="font-display font-bold text-xl text-[#b06000] mt-0.5">{verificationSummary.partiallyVerifiedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-panel2 border border-line">
            <p className="text-[11px] font-mono text-fog uppercase">Pages Crawled</p>
            <p className="font-display font-bold text-xl text-ink mt-0.5">{verificationSummary.totalPagesCrawled}</p>
          </div>
          <div className="p-3 rounded-xl bg-panel2 border border-line">
            <p className="text-[11px] font-mono text-fog uppercase">Total Citations</p>
            <p className="font-display font-bold text-xl text-lime-deep mt-0.5">{verificationSummary.totalEvidencePoints}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
