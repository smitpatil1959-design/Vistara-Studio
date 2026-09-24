import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import type { PresentationSpec } from '../deck-spec';
import { SpecCanvas } from '../components/deck/SpecStage';
import { SECTION_LABELS } from '../lib/themes';

const TYPE_OPTIONS = [
  { id: 'custom', label: 'Blank section' },
  { id: 'features', label: 'Features grid' },
  { id: 'workflow', label: 'How it works' },
  { id: 'benefits', label: 'Metrics / benefits' },
  { id: 'impact', label: 'Impact numbers' },
  { id: 'architecture', label: 'Layered stack' },
  { id: 'implementation', label: 'Implementation plan' },
  { id: 'market', label: 'Market position' },
  { id: 'differentiation', label: 'Differentiation' },
  { id: 'growth', label: 'Growth roadmap' },
  { id: 'solution', label: 'Split statement' },
  { id: 'cta', label: 'Closing / CTA' },
];

interface Props {
  spec: PresentationSpec;
  index: number;
  onSelect: (i: number) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (section: string) => void;
}

/** Left rail — live spec thumbnails with slide operations. */
export default function SlideRail({ spec, index, onSelect, onMove, onDuplicate, onDelete, onAdd }: Props) {
  return (
    <aside className="w-[196px] shrink-0 border-r border-line overflow-y-auto no-scrollbar py-3 px-3 flex flex-col gap-3 max-md:hidden bg-white/50">
      {spec.slides.map((s, i) => (
        <div key={s.id} className={`group relative rounded-xl transition-all bg-white ${i === index ? 'ring-2 ring-lime-deep shadow-[0_10px_24px_-14px_rgba(66,87,10,0.4)]' : 'ring-1 ring-black/10 hover:ring-black/25'}`}>
          <button onClick={() => onSelect(i)} className="block w-full text-left">
            <div className="pointer-events-none rounded-t-xl overflow-hidden">
              <SpecCanvas spec={spec} index={i} />
            </div>
            <div className="px-2.5 py-2 flex items-center justify-between gap-2 border-t border-line/70">
              <span className="text-[10px] font-mono text-fog uppercase tracking-wider truncate">
                {String(i + 1).padStart(2, '0')} · {SECTION_LABELS[s.section] || s.section}
              </span>
            </div>
          </button>
          <div className="absolute top-1.5 right-1.5 hidden group-hover:flex flex-col gap-1">
            <button title="Move up" onClick={() => onMove(s.id, -1)} className="p-1 rounded-md bg-white hairline text-fog hover:text-ink shadow-sm"><ArrowUp size={11} /></button>
            <button title="Move down" onClick={() => onMove(s.id, 1)} className="p-1 rounded-md bg-white hairline text-fog hover:text-ink shadow-sm"><ArrowDown size={11} /></button>
            <button title="Duplicate slide (⌘⇧D)" onClick={() => onDuplicate(s.id)} className="p-1 rounded-md bg-white hairline text-fog hover:text-ink shadow-sm"><Copy size={11} /></button>
            <button title="Delete slide" onClick={() => onDelete(s.id)} className="p-1 rounded-md bg-white hairline text-fog hover:text-[#c4574e] shadow-sm"><Trash2 size={11} /></button>
          </div>
        </div>
      ))}
      <div className="relative">
        <AddButton onAdd={onAdd} />
      </div>
    </aside>
  );
}

import { useState } from 'react';
function AddButton({ onAdd }: { onAdd: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="w-full rounded-xl border border-dashed border-black/20 py-3.5 text-[12px] text-fog hover:text-ink hover:border-lime-deep/60 hover:bg-lime-soft/50 transition-all flex items-center justify-center gap-1.5">
        <Plus size={13} /> Add slide
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 right-0 bottom-full mb-2 glass-deep rounded-xl overflow-hidden z-30 max-h-[300px] overflow-y-auto no-scrollbar">
          {TYPE_OPTIONS.map((o) => (
            <button key={o.id} onClick={() => { onAdd(o.id); setOpen(false); }} className="w-full text-left px-4 py-2.5 text-[12.5px] text-fog hover:text-ink hover:bg-panel2 transition-colors">
              {o.label}
            </button>
          ))}
        </motion.div>
      )}
    </>
  );
}
