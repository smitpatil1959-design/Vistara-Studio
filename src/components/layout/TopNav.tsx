import { Link } from 'react-router-dom';
import Logo from './Logo';
import SessionActions from '../auth/SessionActions';

/** Shared workspace header for interior pages (dashboard, create, settings). */
export default function TopNav({ label, right }: { label?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="hover:opacity-70 transition-opacity" aria-label="Vistara Studio home">
          <Logo />
        </Link>
        {label && <span className="text-[11px] font-mono uppercase tracking-[0.28em] text-fog">{label}</span>}
        <div className="flex items-center gap-2">
          {right}
          <SessionActions />
        </div>
      </div>
    </header>
  );
}
