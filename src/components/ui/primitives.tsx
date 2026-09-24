import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function ScoreRing({
  score,
  size = 120,
  stroke = 9,
  label,
  track = 'rgba(23,23,15,0.08)',
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = score >= 90 ? '#4f6b4a' : score >= 75 ? '#7fa372' : score >= 60 ? '#c99e2e' : '#c4574e';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={score >= 90 ? '#9db494' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold" style={{ fontSize: size * 0.28, lineHeight: 1, color }}>
          {score}
        </span>
        {label && <span className="text-[10px] uppercase tracking-[0.18em] text-fog mt-1">{label}</span>}
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'success' | 'warn' | 'fail' }) {
  const tones: Record<string, string> = {
    default: 'bg-black/[0.04] text-fog border-black/10',
    accent: 'bg-lime text-lime-deep border-[#c2dd55]',
    success: 'bg-[#e7efe2] text-sage-deep border-[#c4d4bb]',
    warn: 'bg-[#faf1d6] text-[#8a6d1c] border-[#e8d5a4]',
    fail: 'bg-[#f9e3e0] text-[#a2403a] border-[#ecc5c0]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EditableText({
  value,
  onCommit,
  className = '',
  style,
  multiline = false,
  placeholder = 'Click to edit',
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerText !== (value || '')) ref.current.innerText = value || '';
  }, [value]);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      className={`editable-field outline-none cursor-text whitespace-pre-wrap ${className}`}
      style={style}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.trim();
        if (v !== (value || '')) onCommit(v);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
      }}
    />
  );
}

export function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-lime-soft hairline flex items-center justify-center text-lime-deep mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      <p className="text-fog text-sm mt-1.5 max-w-sm leading-relaxed">{sub}</p>
    </div>
  );
}

export function SectionHead({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.24em] text-lime-deep mb-2">
          <span className="inline-block w-4 h-[2px] bg-lime-deep/70" /> {kicker}
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {right}
    </div>
  );
}
