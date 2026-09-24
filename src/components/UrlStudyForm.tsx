import { useState } from 'react';
import { Globe, ScanSearch } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

/**
 * The dashboard URL intake form.
 *
 * IMPORTANT — this form does NOT create a study directly.
 * It validates the URL, then navigates to /create?url=... where the user
 * selects a Presentation Purpose before the study is created.
 *
 * This guarantees both entry points (Dashboard "Analyze" and "Study another
 * website") use the SAME canonical setup flow on CreatePage.
 *
 * Guests are routed to /signup with the URL preserved so that after account
 * creation, /create prefills the URL automatically.
 */
export default function UrlStudyForm({ compact = false, defaultValue = '' }: { compact?: boolean; defaultValue?: string }) {
  const { isAuthenticated, loading } = useAuth();
  const nav = useNavigate();
  const [url, setUrl] = useState(defaultValue);
  const [urlError, setUrlError] = useState('');

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) return;
    setUrlError('');

    // Unauthenticated: send to signup, then back to /create?url=... after login
    if (!loading && !isAuthenticated) {
      nav(`/signup?next=${encodeURIComponent(`/create?url=${encodeURIComponent(raw)}`)}`);
      return;
    }

    // Navigate to the canonical study-setup screen, pre-filling the URL.
    // CreatePage reads ?url= from search params, so the user never has to retype.
    nav(`/create?url=${encodeURIComponent(raw)}`);
  };

  return (
    <form onSubmit={go} className="w-full">
      <div className={`glass rounded-2xl p-1.5 flex items-center gap-2 ${compact ? 'bg-white' : 'bg-white shadow-[0_24px_70px_-30px_rgba(66,87,10,0.35)]'}`}>
        <div className="pl-3.5 text-fog">
          <Globe size={17} />
        </div>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
          placeholder="paste a URL — stripe.com, linear.app, your own…"
          aria-label="Website URL to analyze"
          className="flex-1 bg-transparent outline-none text-[15px] py-3 placeholder:text-fog/60 min-w-0"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="btn-grad rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2 shrink-0 disabled:opacity-60"
        >
          <ScanSearch size={15} />
          Analyze
        </button>
      </div>
      {urlError && <p role="alert" className="text-[#a2403a] text-xs mt-2.5 pl-1">{urlError}</p>}
    </form>
  );
}
