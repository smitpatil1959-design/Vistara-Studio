import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, BrainCircuit, Compass, Edit3, Layers3, Loader2, Palette, Plus, RefreshCw, Send,
  Settings2, Sparkles, Trash2, Undo2, XCircle,
} from 'lucide-react';
import type { ChatMsg } from '../types';
import { useAuth } from '../hooks/useAuth';

export interface DirectorPlanItem {
  icon: string;
  label: string;
  detail: string;
}

export interface DirectorTurn {
  reply: string;
  plan: DirectorPlanItem[];
  context: string[];
  dropped: { op: string; reason: string; fields?: string[] }[];
  specVersion: number | null;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  palette: Palette,
  brain: BrainCircuit,
  settings: Settings2,
  edit: Edit3,
  plus: Plus,
  trash: Trash2,
  layers: Layers3,
  refresh: RefreshCw,
  sparkle: Sparkles,
};

const STARTERS = [
  '✦ AI Redesign: Elevate design system, typography & visuals',
  'Make it look like a luxury technology presentation',
  'Use a dark emerald theme with serif headlines',
  'Change to a minimal Apple-style aesthetic',
  'Make this investor focused: shorter copy, outcome slides',
  'Reduce the text on slide 3',
  'Make slide 4 more visual with editorial photography',
  'Use only images from my website',
];


interface Props {
  project: { id: string; name: string; url: string };
  messages: ChatMsg[];
  busy: boolean;
  onCommand: (text: string) => void;
  onQuickStart: (text: string) => void;
  context: string[];
  lastPlan: DirectorPlanItem[];
  lastDropped: DirectorTurn['dropped'];
  onUndo: () => void;
  canUndo: boolean;
}

/** The right-rail Creative Director — plan-first, context-transparent command surface. */
export default function CreativeDirector({ project, messages, busy, onCommand, onQuickStart, context, lastPlan, lastDropped, onUndo, canUndo }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useAuth();
  void project;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, lastPlan]);

  const send = () => {
    const c = draft.trim();
    if (!c || busy) return;
    setDraft('');
    onCommand(c);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-line bg-lime-soft/60">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl chip-lime flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-[13.5px] leading-tight">VISTARA AI <span className="text-lime-deep">Creative Director</span></p>
            <p className="text-[10px] font-mono text-fog mt-0.5">directs the presentation schema — never writes code</p>
          </div>
        </div>
        {/* live context the director is reading */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {context.map((c) => (
            <span key={c} className="text-[9.5px] font-mono hairline bg-white rounded-full px-2.5 py-1 text-fog truncate max-w-full">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="glass rounded-2xl bg-white p-4">
            <p className="text-[12.5px] text-ink/85 leading-relaxed">
              I read the measured scan — pages, palette, health, the brief. Direct the deck as you would a studio partner.
            </p>
            <p className="text-[11px] font-mono text-fog mt-3 uppercase tracking-[0.16em]">Every edit lands in the schema and is reversible.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl px-3.5 py-3 text-[12.5px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-ink text-paper ml-6' : 'glass bg-white text-ink/85 mr-2'}`}>
            {m.role === 'assistant' && (
              <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-lime-deep mb-1.5">
                <Bot size={10} /> Creative Director
              </span>
            )}
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="glass bg-white rounded-2xl px-3.5 py-3 text-[12px] text-fog mr-2 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-lime-deep" /> Restructuring the deck…
          </div>
        )}

        {/* last plan — the traceable action list */}
        {lastPlan.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-deep/25 bg-lime-soft/60 p-3.5">
            <p className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-lime-deep mb-2">Applied — validated actions</p>
            <div className="flex flex-col gap-1.5">
              {lastPlan.map((p, i) => {
                const Icon = PLAN_ICONS[p.icon] || Compass;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5.5 h-5.5 w-6 h-6 rounded-md chip-lime flex items-center justify-center shrink-0">
                      <Icon size={11} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">{p.label}</span>
                      {p.detail && <span className="block text-[10.5px] font-mono text-fog mt-0.5">{p.detail}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {lastDropped.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-lime-deep/15 flex flex-col gap-1">
                {lastDropped.map((d, i) => (
                  <p key={i} className="text-[10px] font-mono text-[#8a6d1c] flex items-start gap-1.5">
                    <XCircle size={10} className="mt-0.5 shrink-0" /> skipped {d.op} — {d.reason}
                  </p>
                ))}
              </div>
            )}
            {canUndo && (
              <button onClick={onUndo} className="mt-3 text-[11px] font-mono text-lime-deep hover:text-ink transition-colors flex items-center gap-1.5">
                <Undo2 size={11} /> Undo before this turn (⌘Z)
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* quick directives */}
      <div className="px-4 pb-2.5 flex flex-wrap gap-1.5">
        {STARTERS.slice(0, 3).map((s) => (
          <button key={s} disabled={busy} onClick={() => onQuickStart(s)} className="text-[9.5px] font-mono text-fog hover:text-ink glass bg-white rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50">
            {s.length > 40 ? s.slice(0, 40) + '…' : s}
          </button>
        ))}
      </div>

      {/* composer */}
      <div className="p-4 pt-2 border-t border-line bg-white/80">
        <div className="glass-deep bg-white rounded-xl p-1 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Direct the story — an instruction, not a question…"
            className="flex-1 bg-transparent outline-none text-[13px] px-3 py-2.5 placeholder:text-fog/50 min-w-0"
          />
          <button onClick={send} disabled={busy || !draft.trim()} className="btn-grad rounded-lg p-2.5 disabled:opacity-40" title="Send directive (Enter)">
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] font-mono text-fog/60 text-center mt-2 uppercase tracking-[0.16em]">
          structured actions only · validated before write · undo with ⌘Z
        </p>
      </div>
    </div>
  );
}
