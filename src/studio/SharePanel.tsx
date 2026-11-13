import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Eye as Eye1, Link2 as Link22, Lock as Lock2 } from 'lucide-react';
import { setDeckVisibility } from '../services';

export default function ShareCard({
  projectId,
  visibility,
  onVisibility,
  onClose,
  onToast,
}: {
  projectId: string;
  visibility: 'public' | 'unlisted' | 'private';
  onVisibility: (v: 'public' | 'unlisted' | 'private') => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const link = `${window.location.origin}/p/${projectId}`;

  const MODE: { id: 'public' | 'unlisted' | 'private'; icon: React.ElementType; title: string; body: string }[] = [
    { id: 'public', icon: Eye1, title: 'Public', body: 'Listed in the showcase gallery; anyone can open the link.' },
    { id: 'unlisted', icon: Link22, title: 'Unlisted', body: 'Only people you share the link with can open it. Default.' },
    { id: 'private', icon: Lock2, title: 'Private', body: 'Only the signed-in owner can open this presentation.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="absolute top-12 right-4 z-40 w-[340px] glass-deep bg-white rounded-2xl p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-semibold text-[14px]">Share & visibility</p>
        <button aria-label="Close sharing settings" onClick={onClose} className="p-1 rounded-md text-fog hover:text-ink">
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 mb-4">
        {MODE.map((m) => (
          <button
            key={m.id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setDeckVisibility(projectId, m.id);
                onVisibility(m.id);
                onToast(`Visibility set to ${m.title}`);
              } catch (error) {
                onToast(error instanceof Error ? error.message : 'Could not change presentation visibility.');
              } finally {
                setBusy(false);
              }
            }}
            className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all ${visibility === m.id ? 'chip-lime' : 'glass bg-white hover:border-black/25'}`}
          >
            <m.icon size={14} className={visibility === m.id ? 'text-lime-deep mt-0.5' : 'text-fog mt-0.5'} />
            <span className="min-w-0">
              <span className={`block text-[12.5px] font-semibold ${visibility === m.id ? 'text-lime-deep' : 'text-ink'}`}>{m.title}</span>
              <span className={`block text-[11px] leading-snug mt-0.5 ${visibility === m.id ? 'text-lime-deep/80' : 'text-fog'}`}>{m.body}</span>
            </span>
            {visibility === m.id && <Check size={13} className="ml-auto mt-0.5 text-lime-deep shrink-0" />}
          </button>
        ))}
      </div>
      <div className="hairline rounded-xl bg-panel2 p-1.5 flex items-center gap-2">
        <span className="flex-1 truncate font-mono text-[11px] text-fog pl-2">{link}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(link).then(() => onToast('Share link copied')).catch(() => window.prompt('Copy the share link:', link))}
          className="btn-grad rounded-lg px-3.5 py-2 text-[11.5px] font-semibold shrink-0"
        >
          Copy link
        </button>
      </div>
      <p className="text-[10px] font-mono text-fog/70 mt-3 leading-relaxed">
        Visibility is enforced on the server: private decks return a private screen for unsigned viewers, everywhere.
      </p>
    </motion.div>
  );
}

