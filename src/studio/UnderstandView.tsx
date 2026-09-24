import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit, Check, CheckCircle2, FileText, Globe2, Landmark, Loader2, RefreshCw, Save, ShieldCheck, Sparkles, TriangleAlert, Wand2, Zap,
} from 'lucide-react';
import type { Project } from '../types';
import type { ScopedValue, RichUnderstanding as RichT } from '../lib/understanding';
import { isRichUnderstanding } from '../lib/understanding';
import { updateProject } from '../services';
import { request } from '../services/http';
import { Spinner, Pill } from '../components/ui';

const API = '/api/understand';

/* ------------------------------------------------ small pieces */

function BasisChip({ basis }: { basis: 'fact' | 'inferred' }) {
  return basis === 'fact' ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] bg-[#e7efe2] text-sage-deep border border-[#c4d4bb] rounded-full px-2 py-0.5">
      <ShieldCheck size={9} /> fact
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] chip-lime rounded-full px-2 py-0.5">
      <Sparkles size={9} /> inferred
    </span>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${pct}%`}>
      <span className="w-10 h-1 rounded-full bg-black/[0.08] overflow-hidden inline-block">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? '#6f9463' : pct >= 55 ? '#a3bd6e' : '#d9b54a' }} />
      </span>
      <span className="text-[10px] font-mono text-fog">{pct}%</span>
    </span>
  );
}

function Evidence({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <span className="inline-flex flex-col items-start">
      <button onClick={() => setOpen(!open)} className="text-[10px] font-mono text-fog hover:text-ink transition-colors underline underline-offset-2">
        {open ? 'hide evidence' : `${items.length} evidence`}
      </button>
      {open && (
        <span className="mt-1.5 flex flex-col gap-1">
          {items.map((e, i) => (
            <span key={i} className="text-[10.5px] font-mono text-ink/60 bg-panel2 hairline rounded px-2 py-1">{e}</span>
          ))}
        </span>
      )}
    </span>
  );
}

type EditMap = Record<string, string>;

function ScopedCard({ sv, onEdit, editValue, label }: { sv: ScopedValue; onEdit?: (v: string) => void; editValue?: string; label?: string }) {
  const editable = !!onEdit;
  return (
    <div className="rounded-xl hairline bg-panel2 p-4">
      {label && <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-fog mb-2">{label}</p>}
      {editable ? (
        <input
          className="input-ghost rounded-lg px-3 py-2 text-[13.5px] w-full bg-white"
          value={editValue ?? sv.value}
          onChange={(e) => onEdit(e.target.value)}
        />
      ) : (
        <p className="text-[13.5px] leading-relaxed text-ink/90">{sv.value || '—'}</p>
      )}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <BasisChip basis={editable && editValue !== undefined && editValue !== sv.value ? 'fact' : sv.basis} />
        <Confidence value={editable && editValue !== undefined && editValue !== sv.value ? 1 : sv.confidence} />
        <Evidence items={sv.evidence} />
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, sub, children }: { icon: React.ElementType; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="glass rounded-2xl p-6 bg-white">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl bg-lime-soft hairline flex items-center justify-center">
          <Icon size={15} className="text-lime-deep" />
        </span>
        <div>
          <h3 className="font-display font-semibold text-[15px]">{title}</h3>
          {sub && <p className="text-[11px] text-fog mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------ page */

export default function UnderstandView({ project, onSaved }: { project: Project; onSaved: (u: never) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [edits, setEdits] = useState<EditMap>({});
  const [tried, setTried] = useState(false);
  const requested = useRef(false);

  const raw = project.understanding as unknown as RichT | null;
  const rich = useMemo(() => (isRichUnderstanding(raw) ? raw : null), [raw]);

  // auto-compose brief when a scan exists but no brief does
  useEffect(() => {
    if (rich || !project.analysis || requested.current) return;
    requested.current = true;
    void reinterpret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rich, project.analysis]);

  async function reinterpret() {
    setBusy(true);
    setError('');
    setTried(true);
    try {
      const data = await request<{ understanding: unknown }>(API, { method: 'POST', body: JSON.stringify({ projectId: project.id }) });
      onSaved(data.understanding as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Understanding failed');
    } finally {
      setBusy(false);
    }
  }

  const overridden = async () => {
    if (!rich) return;
    const next: RichT = JSON.parse(JSON.stringify(rich));
    const put = (sv: ScopedValue | undefined, key: string) => {
      if (sv && edits[key] !== undefined && edits[key] !== sv.value) {
        sv.value = edits[key];
        sv.basis = 'fact';
        sv.confidence = 1;
        sv.evidence = ['overridden by the editor'];
      }
    };
    put(next.identity.websiteName, 'websiteName');
    put(next.identity.productName, 'productName');
    put(next.identity.tagline, 'tagline');
    put(next.classification.category, 'category');
    put(next.audience.primary, 'audience');
    put(next.purpose.primary, 'purpose');
    put(next.value.uniqueSellingPoint, 'usp');
    put(next.content.tone, 'tone');
    setBusy(true);
    try {
      const p = await updateProject(project.id, { understanding: next as never });
      onSaved(p.understanding as never);
      setEdits({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setBusy(false);
    }
  };

  const [filter, setFilter] = useState<'all' | 'fact' | 'inferred'>('all');
  const keep = (sv: ScopedValue) => filter === 'all' || sv.basis === filter;

  if (!project.analysis) {
    return <p className="text-fog text-sm py-10 text-center">Run the analysis first — the brief is written from measured scan data.</p>;
  }

  if (!rich) {
    return (
      <div className="glass rounded-3xl bg-white p-10 text-center max-w-lg mx-auto mt-6">
        {busy && !error ? (
          <>
            <Loader2 size={22} className="animate-spin text-lime-deep mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg">Composing the brief…</h3>
            <p className="text-fog text-sm mt-2 leading-relaxed">
              Structured facts from the crawl are being interpreted — every claim will be tagged as measured or inferred.
            </p>
          </>
        ) : error || tried ? (
          <>
            <span className="w-12 h-12 rounded-2xl bg-[#f9e3e0] border border-[#ecc5c0] flex items-center justify-center text-[#a2403a] mx-auto mb-4">
              <TriangleAlert size={20} />
            </span>
            <h3 className="font-display font-semibold text-lg">The brief could not be composed</h3>
            <p className="text-fog text-sm mt-2 leading-relaxed">{error || 'The interpreter returned nothing usable.'}</p>
            <button onClick={reinterpret} disabled={busy} className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold mt-6 inline-flex items-center gap-2 disabled:opacity-60">
              {busy ? <Spinner size={14} /> : <RefreshCw size={14} />} Retry interpretation
            </button>
          </>
        ) : null}
      </div>
    );
  }

  const meta = rich.meta;
  const factPct = Math.round((meta.factShare || 0) * 100);
  const pendingEdits = Object.keys(edits).length;

  return (
    <div className="pb-10">
      {/* header banner */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl bg-white p-7 md:p-8 noise relative overflow-hidden mb-5">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.5), transparent)', filter: 'blur(28px)' }} />
        <div className="flex flex-wrap items-start gap-4 relative">
          <span className="w-11 h-11 rounded-2xl chip-lime flex items-center justify-center shrink-0">
            <BrainCircuit size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">The creative brief</h2>
            <p className="text-fog text-[13px] mt-1 max-w-xl leading-relaxed">
              {rich.identity.productName.value} — interpreted from the measured scan. Facts are proven from the page; inferences are labeled and confidence-scored.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Pill tone="accent">engine: {meta.engine}{meta.model ? `:${meta.model}` : ''}</Pill>
            <Pill tone={meta.validated ? 'success' : 'warn'}>{meta.validated ? 'schema-valid' : 'schema-recovered'}</Pill>
            <Pill>{meta.attempts} attempt{meta.attempts > 1 ? 's' : ''}</Pill>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-7 relative">
          <div className="rounded-2xl bg-panel2 hairline p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Measured facts</p>
            <p className="font-display text-3xl font-semibold mt-1.5 text-sage-deep">{factPct}%</p>
            <div className="h-1.5 rounded-full bg-black/[0.07] mt-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${factPct}%`, background: 'linear-gradient(90deg,#9db494,#6f9463)' }} /></div>
          </div>
          <div className="rounded-2xl bg-panel2 hairline p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Interpreted signals</p>
            <p className="font-display text-3xl font-semibold mt-1.5 text-lime-deep">{100 - factPct}%</p>
            <p className="text-[11px] text-fog mt-2.5">Clearly marked as inference — never presented as fact.</p>
          </div>
          <div className="rounded-2xl bg-panel2 hairline p-4 flex flex-col justify-between">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">Engine note</p>
            <p className="text-[11.5px] text-ink/70 leading-relaxed mt-2">{meta.note || 'Provider returned a schema-valid interpretation on first pass.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mt-6 flex-wrap relative">
          {(['all', 'fact', 'inferred'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-[11.5px] font-medium transition-all ${filter === f ? 'bg-ink text-paper' : 'glass bg-white text-fog hover:text-ink'}`}>
              {f === 'all' ? 'All signals' : f === 'fact' ? 'Facts only' : 'Interpretations only'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={reinterpret} disabled={busy} className="btn-quiet rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-1.5">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-interpret
            </button>
            <button onClick={overridden} disabled={busy || pendingEdits === 0} className="btn-grad rounded-xl px-4 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {saved ? <Check size={13} /> : <Save size={13} />} {saved ? 'Saved' : pendingEdits ? `Save ${pendingEdits} override${pendingEdits > 1 ? 's' : ''}` : 'Save brief'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* identity */}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {(
          [
            ['productName', rich.identity.productName, 'Product name', Globe2],
            ['websiteName', rich.identity.websiteName, 'Website name', FileText],
            ['tagline', rich.identity.tagline, 'Tagline', Zap],
          ] as [string, ScopedValue, string, React.ElementType][]
        ).map(([key, sv, label, Icon]) => (
          <Section key={key} icon={Icon} title={label}>
            <ScopedCard sv={sv} editValue={edits[key]} onEdit={(v) => setEdits((e) => ({ ...e, [key]: v }))} />
          </Section>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* classification + purpose */}
        <Section icon={Landmark} title="Classification & purpose" sub={rich.classification.subcategory ? `Subcategory: ${rich.classification.subcategory}` : undefined}>
          <div className="flex flex-col gap-3">
            <ScopedCard label="Category" sv={rich.classification.category} editValue={edits.category} onEdit={(v) => setEdits((e) => ({ ...e, category: v }))} />
            <ScopedCard label="Primary purpose" sv={rich.purpose.primary} editValue={edits.purpose} onEdit={(v) => setEdits((e) => ({ ...e, purpose: v }))} />
            {rich.purpose.callToActionHint && <p className="text-[11px] font-mono text-fog">CTA hint · {rich.purpose.callToActionHint}</p>}
          </div>
        </Section>

        {/* audience */}
        <Section icon={Globe2} title="Target audience">
          <ScopedCard label="Primary" sv={rich.audience.primary} editValue={edits.audience} onEdit={(v) => setEdits((e) => ({ ...e, audience: v }))} />
          <div className="flex flex-col gap-2 mt-3">
            {rich.audience.segments.filter(keep).map((s, i) => (
              <ListRow key={i} sv={s} />
            ))}
          </div>
        </Section>

        {/* value */}
        <Section icon={Sparkles} title="Unique value proposition">
          <ScopedCard sv={rich.value.uniqueSellingPoint} editValue={edits.usp} onEdit={(v) => setEdits((e) => ({ ...e, usp: v }))} />
          <div className="flex flex-col gap-2 mt-3">
            {rich.value.differentiators.filter(keep).map((s, i) => (
              <ListRow key={i} sv={s} />
            ))}
          </div>
        </Section>

        {/* offering */}
        <Section icon={Wand2} title="Features, services & benefits">
          <Cluster label="Key features" items={rich.offering.keyFeatures} keep={keep} />
          <Cluster label="Services" items={rich.offering.services} keep={keep} />
          <Cluster label="Benefits" items={rich.offering.benefits} keep={keep} />
        </Section>

        {/* technology */}
        <Section icon={ShieldCheck} title="Technology signals" sub={rich.technology.stackSummary ?? undefined}>
          <div className="flex flex-wrap gap-2">
            {rich.technology.signals.filter(keep).map((s, i) => (
              <div key={i} className="rounded-lg hairline bg-panel2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{s.value}</span>
                  <BasisChip basis={s.basis} />
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <Confidence value={s.confidence} />
                  <Evidence items={s.evidence} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* content */}
        <Section icon={FileText} title="Important pages & messages">
          <div className="flex flex-col gap-2">
            {rich.content.importantPages.filter((p) => filter === 'all' || p.basis === filter).map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg hairline bg-panel2 px-3.5 py-2.5">
                <span className="font-mono text-[11.5px] text-sage-deep shrink-0">{p.path}</span>
                <span className="text-[12.5px] text-ink/80 truncate flex-1">{p.title}</span>
                <BasisChip basis={p.basis} />
                <Confidence value={p.confidence} />
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mt-5 mb-2">Key messages</p>
          <div className="flex flex-col gap-2">
            {rich.content.keyMessages.filter(keep).map((s, i) => (
              <ListRow key={i} sv={s} />
            ))}
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mt-5 mb-2">Tone</p>
          <ScopedCard sv={rich.content.tone} editValue={edits.tone} onEdit={(v) => setEdits((e) => ({ ...e, tone: v }))} />
        </Section>

        {/* story */}
        <Section icon={BrainCircuit} title="Suggested presentation story" sub="How the deck should argue its case" >
          <ScopedCard sv={rich.story.suggestedNarrative} />
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            {rich.story.sectionArc.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="text-[10.5px] font-mono chip-lime rounded-full px-2.5 py-1">{s}</span>
                {i < rich.story.sectionArc.length - 1 && <span className="text-fog/40 text-[10px]">→</span>}
              </span>
            ))}
          </div>
          {rich.story.watchouts.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {rich.story.watchouts.map((w, i) => (
                <p key={i} className="text-[12px] text-[#8a6d1c] bg-[#faf1d6] border border-[#e8d5a4] rounded-lg px-3 py-2">{w}</p>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-6 glass rounded-2xl px-6 py-4 flex items-center gap-3 text-[13px] text-fog bg-lime-soft border-lime-deep/20">
        <CheckCircle2 size={15} className="text-lime-deep shrink-0" />
        Overrides above are stored with basis “fact — overridden by the editor” at 100% confidence, then flow into deck generation.
      </div>
    </div>
  );
}

function ListRow({ sv }: { sv: ScopedValue }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white hairline px-3.5 py-2.5">
      <span className="text-[12.5px] text-ink/85 leading-relaxed flex-1 min-w-0">{sv.value}</span>
      <span className="shrink-0 flex flex-col items-end gap-1">
        <BasisChip basis={sv.basis} />
        <Confidence value={sv.confidence} />
        <Evidence items={sv.evidence} />
      </span>
    </div>
  );
}

function Cluster({ label, items, keep }: { label: string; items: ScopedValue[]; keep: (s: ScopedValue) => boolean }) {
  const visible = items.filter(keep);
  if (!visible.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-2">{label}</p>
      <div className="flex flex-col gap-2">
        {visible.map((s, i) => (
          <ListRow key={i} sv={s} />
        ))}
      </div>
    </div>
  );
}
