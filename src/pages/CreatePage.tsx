import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, FileText, Globe, GraduationCap, Landmark, LayoutGrid,
  Loader2, Radar, Rocket, Sparkles, TrendingUp, Wand2,
} from 'lucide-react';
import TopNav from '../components/layout/TopNav';
import Ambient from '../components/layout/Ambient';
import { useCreateStudy } from '../hooks/useCreateStudy';
import { useProjects } from '../hooks/useProjects';
import { hostOf, validateUrl, type UrlVerdict } from '../lib/format';
import type { CreateStudyInput, PresentationPurpose } from '../types';

/* ------------------------------------------------ purpose taxonomy */

const PURPOSES: { id: PresentationPurpose; label: string; sub: string; icon: React.ElementType }[] = [
  { id: 'college', label: 'College Project', sub: 'Clear argument, methodology, honest scope', icon: GraduationCap },
  { id: 'investor', label: 'Investor', sub: 'Evidence first, momentum and the ask', icon: TrendingUp },
  { id: 'client', label: 'Client', sub: 'Confidence fast — details on demand', icon: Landmark },
  { id: 'product-demo', label: 'Product Demo', sub: 'Flows over features, show don’t tell', icon: Rocket },
  { id: 'portfolio', label: 'Portfolio', sub: 'Craft and range, front and center', icon: LayoutGrid },
  { id: 'general', label: 'General', sub: 'A balanced boardroom-safe narrative', icon: FileText },
];

const PROMPT_EXAMPLES = [
  'Ultra-premium, dark, cinematic, champagne gold accents, sophisticated animations.',
  'Minimalist warm paper, editorial serif headlines, generous whitespace.',
  'Bold startup energy — snappy motion, high-contrast type, electric accent.',
];

/* ------------------------------------------------ live step states */

type FlowState = 'idle' | 'validating' | 'creating' | 'starting' | 'handoff' | 'error';

const FLOW_STEPS: { key: string; label: string; when: FlowState[] }[] = [
  { key: 'validate', label: 'URL validated', when: ['validating', 'creating', 'starting', 'handoff'] },
  { key: 'create', label: 'Study created in workspace', when: ['creating', 'starting', 'handoff'] },
  { key: 'analyze', label: 'Analysis queued — crawler warming up', when: ['starting', 'handoff'] },
  { key: 'open', label: 'Opening the studio', when: ['handoff'] },
];

function FlowStepper({ state }: { state: FlowState }) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      {FLOW_STEPS.map((step) => {
        const reached = step.when.includes(state);
        const isLast = step.when[step.when.length - 1] === state && state !== 'handoff';
        return (
          <motion.div
            key={step.key}
            initial={false}
            animate={{ opacity: reached ? 1 : 0.4 }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${reached ? 'bg-panel2 border-line' : 'bg-white/60 border-line/60'
              }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${reached ? 'chip-lime' : 'bg-black/[0.06] text-fog'
                }`}
            >
              {isLast ? <Loader2 size={12} className="animate-spin text-lime-deep" /> : reached ? <Check size={12} className="text-lime-deep" /> : <span className="text-[10px] font-mono">·</span>}
            </span>
            <span className={`text-[12.5px] ${reached ? 'text-ink font-medium' : 'text-fog'}`}>{step.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------ page */

export default function CreatePage() {
  const { create } = useCreateStudy();
  const { projects } = useProjects();
  const [params] = useSearchParams();

  const [url, setUrl] = useState(params.get('url') ?? '');
  const [purpose, setPurpose] = useState<PresentationPurpose | null>(null);
  const [designPrompt, setDesignPrompt] = useState('');
  const [flow, setFlow] = useState<FlowState>('idle');
  const [error, setError] = useState('');

  const verdict: UrlVerdict = useMemo(() => validateUrl(url), [url]);
  const duplicate = verdict.state === 'valid' ? projects.find((p) => hostOf(p.url) === verdict.host) : undefined;

  const canSubmit = verdict.state === 'valid' && (flow === 'idle' || flow === 'error');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || verdict.state !== 'valid') return;
    setError('');
    setFlow('validating');
    await new Promise((r) => setTimeout(r, 400));
    setFlow('creating');
    try {
      // null purpose is allowed — treated as 'general' by the backend
      const input: CreateStudyInput = { url: verdict.normalized, purpose: purpose ?? 'general', designPrompt: designPrompt.trim() };
      setFlow('starting');
      await create(input); // navigates to /project/:id on success (crawl starts there live)
      setFlow('handoff');
    } catch (ex) {
      setFlow('idle');
      setError(ex instanceof Error ? ex.message : 'Could not create the study.');
    }
  }

  return (
    <div className="min-h-screen relative">
      <Ambient />
      <TopNav label="New study" />

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-start">
        {/* left — the form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
          <span className="chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] inline-flex">
            New study
          </span>
          <h1 className="font-display text-4xl md:text-[54px] font-semibold tracking-[-0.03em] mt-5 leading-[1.02]">
            Brief Vistara like a <span className="font-serif italic font-normal text-grad">creative director.</span>
          </h1>
          <p className="text-fog mt-4 text-[15px] max-w-lg leading-relaxed">
            Give the studio the source URL, who the deck is for, and an optional design direction. The crawl,
            audit and first draft land in about thirty seconds.
          </p>

          <form onSubmit={submit} className="mt-9 flex flex-col gap-7" noValidate>
            {/* website url */}
            <div>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog">Website URL</span>
                <div
                  className={`mt-2 input-ghost rounded-2xl px-4 py-3.5 flex items-center gap-3 ${verdict.state === 'invalid' && url ? 'border-[#c4574e]/60' : verdict.state === 'valid' ? 'border-lime-deep/50' : ''
                    }`}
                >
                  <Globe size={16} className="text-fog shrink-0" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="linear.app or https://your-site.com"
                    aria-label="Website URL"
                    aria-invalid={verdict.state === 'invalid'}
                    className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
                  />
                  {verdict.state === 'valid' && <CheckCircle2 size={17} className="text-sage-deep shrink-0" />}
                  {flow !== 'idle' && flow !== 'error' && <Loader2 size={16} className="animate-spin text-lime-deep shrink-0" />}
                </div>
              </label>
              {verdict.state === 'invalid' && url.trim() !== '' && (
                <p role="alert" className="text-[12px] text-[#a2403a] mt-2 flex items-center gap-1.5">
                  <AlertCircle size={12} /> {verdict.reason}
                </p>
              )}
              {verdict.state === 'valid' && (
                <p className="text-[12px] text-sage-deep mt-2 font-mono">
                  ✓ ready to read <span className="text-ink/70">{verdict.normalized}</span>
                </p>
              )}
              {duplicate && (
                <div className="mt-3 rounded-xl bg-[#faf1d6] border border-[#e8d5a4] px-4 py-3 flex items-center gap-3 text-[12.5px] text-[#8a6d1c]">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1">
                    You already studied <strong>{duplicate.name}</strong>.
                    <Link to={`/project/${duplicate.id}`} className="underline underline-offset-2 font-semibold ml-1.5 hover:text-[#634e12]">
                      Open previous study →
                    </Link>
                  </span>
                  <span className="text-[11px] font-mono text-[#8a6d1c]/75 bg-black/[0.04] px-2 py-0.5 rounded-md whitespace-nowrap">
                    Re-study enabled
                  </span>
                </div>
              )}
            </div>

            {/* purpose */}
            <fieldset>
              <legend className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog mb-3">
                Presentation purpose
                {purpose === null && (
                  <span className="ml-2 normal-case tracking-normal text-fog/50 text-[10px]">(optional — defaults to General)</span>
                )}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PURPOSES.map((p) => {
                  const on = purpose === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      id={`purpose-${p.id}`}
                      onClick={() => setPurpose(on ? null : p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPurpose(on ? null : p.id);
                        }
                      }}
                      aria-pressed={on}
                      aria-label={`${p.label}: ${p.sub}`}
                      className={`rounded-2xl px-4 py-3.5 text-left transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-deep focus-visible:ring-offset-2 ${on
                        ? 'chip-lime ring-1 ring-lime-deep'
                        : 'glass bg-white text-fog hover:text-ink hover:border-black/25'
                        }`}
                    >
                      {/* Selected indicator */}
                      {on && (
                        <span className="absolute top-2.5 right-2.5 text-lime-deep" aria-hidden="true">
                          <CheckCircle2 size={14} />
                        </span>
                      )}
                      <p.icon size={15} className={on ? 'text-lime-deep' : 'text-fog'} />
                      <span className={`block text-[13px] font-semibold mt-2 ${on ? 'text-lime-deep' : 'text-ink'}`}>{p.label}</span>
                      <span className="block text-[10.5px] mt-0.5 leading-snug">{p.sub}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* design prompt */}
            <div>
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog flex items-center gap-1.5">
                  <Wand2 size={11} /> AI design direction <span className="normal-case tracking-normal text-fog/60">(optional)</span>
                </span>
                <textarea
                  value={designPrompt}
                  onChange={(e) => setDesignPrompt(e.target.value.slice(0, 600))}
                  rows={3}
                  maxLength={600}
                  placeholder="e.g. Make it ultra-premium, dark, cinematic, with champagne gold accents and sophisticated animations."
                  className="mt-2 input-ghost rounded-2xl px-4 py-3.5 text-[14px] w-full leading-relaxed resize-none"
                />
              </label>
              <div className="flex items-center justify-between mt-2 gap-3">
                <div className="flex gap-1.5 flex-wrap">
                  {PROMPT_EXAMPLES.map((ex) => (
                    <button
                      type="button"
                      key={ex}
                      onClick={() => setDesignPrompt(ex)}
                      className="text-[10.5px] font-mono text-fog hover:text-ink glass bg-white rounded-full px-2.5 py-1 transition-colors truncate max-w-[210px]"
                    >
                      {ex.split(',')[0]}…
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-mono text-fog/60 shrink-0">{designPrompt.length}/600</span>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-[12.5px] text-[#a2403a] bg-[#f9e3e0] border border-[#ecc5c0] rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-grad rounded-2xl px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-45"
            >
              {flow === 'idle' || flow === 'error' ? (
                <>
                  <Radar size={16} /> {duplicate ? 'Re-study website & start analysis' : 'Create study & start analysis'}
                </>
              ) : (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {flow === 'validating' ? 'Validating URL…' : flow === 'creating' ? 'Creating study…' : flow === 'starting' ? 'Queuing analysis…' : 'Opening studio…'}
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* right — progress + what happens next */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="lg:sticky lg:top-24 flex flex-col gap-4"
        >
          {/* live progress */}
          <div className="glass rounded-3xl bg-white p-6 md:p-7 noise relative overflow-hidden">
            <div
              className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.45), transparent)', filter: 'blur(26px)' }}
            />
            <div className="flex items-center gap-2.5 relative">
              <Sparkles size={15} className="text-lime-deep" />
              <h2 className="font-display font-semibold">Pipeline status</h2>
              {flow !== 'idle' && flow !== 'error' && (
                <span className="ml-auto chip-lime rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold">RUNNING</span>
              )}
            </div>
            <div className="mt-5 relative">
              <FlowStepper state={flow} />
            </div>
            {flow === 'error' && (
              <p className="text-[12px] text-[#a2403a] mt-4 flex items-center gap-1.5">
                <AlertCircle size={12} /> Creation failed — nothing was saved. Fix the issue above and retry.
              </p>
            )}
            {flow === 'idle' && (
              <p className="text-[12px] text-fog mt-4 leading-relaxed">
                Nothing runs until you submit. The crawler only reads public pages, and the first analysis lands in the studio — no fake previews here.
              </p>
            )}
          </div>

          {/* what the studio will do */}
          <div className="glass rounded-3xl bg-white p-6 md:p-7">
            <h3 className="font-display font-semibold text-[15px]">What the studio does next</h3>
            <div className="flex flex-col gap-3.5 mt-4">
              {[
                { icon: Globe, t: 'Crawl the live site', d: 'Pages, content, links, palette, tech stack.' },
                { icon: CheckCircle2, t: 'Audit five axes', d: 'Technical, responsive, accessibility, performance, security — with evidence.' },
                { icon: Sparkles, t: 'Write the brief', d: `Audience, USPs and tone — tuned for a ${PURPOSES.find((p) => p.id === purpose)?.label.toLowerCase() ?? 'general'} audience.` },
                { icon: Wand2, t: 'Compose the deck', d: designPrompt.trim() ? `Eleven sections styled by your direction: “${designPrompt.trim().slice(0, 52)}${designPrompt.trim().length > 52 ? '…' : ''}”` : 'Eleven sections, ready to edit by hand or by sentence.' },
              ].map((row, i) => (
                <div key={row.t} className="flex gap-3.5">
                  <span className="w-8 h-8 rounded-lg bg-lime-soft hairline flex items-center justify-center shrink-0">
                    <row.icon size={14} className="text-lime-deep" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">
                      {row.t} <span className="text-fog/50 font-mono text-[10px] ml-1">0{i + 1}</span>
                    </p>
                    <p className="text-[12px] text-fog mt-0.5 leading-relaxed">{row.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/dashboard" className="text-[12.5px] text-lime-deep font-medium hover:text-ink transition-colors mt-5 inline-flex items-center gap-1.5">
              Back to dashboard <ArrowRight size={13} />
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
