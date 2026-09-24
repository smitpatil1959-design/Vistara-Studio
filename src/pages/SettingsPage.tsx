import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, KeyRound, LogOut, MoonStar, Palette, ShieldCheck, Sun, UserRound } from 'lucide-react';
import TopNav from '../components/layout/TopNav';
import Ambient from '../components/layout/Ambient';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_PREFS, getPrefs, savePrefs } from '../lib/prefs';
import { HEADING_FONTS, PALETTES } from '../lib/themes';
import type { DeckSkin, StudioPrefs } from '../types';

const MOTIONS = [
  { id: 'calm', label: 'Calm' },
  { id: 'smooth', label: 'Smooth' },
  { id: 'snappy', label: 'Snappy' },
] as const;

/** /settings — account, workspace theme defaults and data notes. */
export default function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [prefs, setPrefs] = useState<StudioPrefs>(getPrefs);
  const [saved, setSaved] = useState(false);

  const applyPrefs = (patch: Partial<StudioPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const email = user?.email ?? null;

  const handleSignOut = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <div className="min-h-screen relative">
      <Ambient />
      <TopNav label="Settings" />

      <main className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">Studio settings</h1>
          <p className="text-fog mt-2 text-[14px]">Account, defaults for new studies, and how your data behaves.</p>
        </motion.div>

        {/* account */}
        <section className="glass rounded-2xl bg-white p-6 md:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <UserRound size={15} className="text-lime-deep" />
            <h2 className="font-display font-semibold">Account</h2>
          </div>
          {loading ? (
            <p className="text-fog text-sm">Checking session…</p>
          ) : email ? (
            <div className="flex items-center gap-4 flex-wrap">
              <span className="w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center font-display font-semibold">
                {email.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{email}</p>
                <p className="text-[11px] font-mono text-fog">signed in</p>
              </div>
              <button
                onClick={handleSignOut}
                className="btn-quiet rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-1.5 ml-auto"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <span className="w-11 h-11 rounded-full bg-lime-soft hairline flex items-center justify-center">
                <UserRound size={17} className="text-lime-deep" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Guest workspace</p>
                <p className="text-[11.5px] text-fog mt-0.5">
                  'Sign in to keep studies tied to your account across devices.'
                </p>
              </div>
              <Link to="/login" className="btn-grad rounded-xl px-4 py-2.5 text-[12.5px] font-semibold ml-auto flex items-center gap-1.5">
                <KeyRound size={13} /> Sign in
              </Link>
            </div>
          )}
        </section>

        {/* studio defaults */}
        <section className="glass rounded-2xl bg-white p-6 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <Palette size={15} className="text-lime-deep" />
              <h2 className="font-display font-semibold">Default theme for new studies</h2>
            </div>
            {saved && (
              <span className="text-[11px] font-mono text-sage-deep flex items-center gap-1">
                <Check size={11} /> saved
              </span>
            )}
          </div>

          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog mb-2.5">Palette</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {PALETTES.map((p) => {
              const on = prefs.paletteId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPrefs({ paletteId: p.id })}
                  className={`rounded-lg px-3 py-2.5 text-left transition-all flex items-center gap-2.5 ${on ? 'chip-lime' : 'glass bg-white hover:border-black/25'}`}
                >
                  <span className="flex -space-x-1">
                    <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ background: p.accent }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ background: p.accent2 }} />
                  </span>
                  <span className={`text-[11.5px] ${on ? 'text-lime-deep font-medium' : 'text-fog'}`}>{p.name}</span>
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mt-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog mb-2.5">Motion</p>
              <div className="grid grid-cols-3 gap-1.5">
                {MOTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => applyPrefs({ motion: m.id })}
                    className={`rounded-lg py-2.5 text-[12px] transition-all ${prefs.motion === m.id ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fog mb-2.5">Deck skin</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'light' as DeckSkin, label: 'Paper', icon: Sun },
                    { id: 'dark' as DeckSkin, label: 'Ink', icon: MoonStar },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applyPrefs({ skin: s.id })}
                    className={`rounded-lg py-2.5 text-[12px] flex items-center justify-center gap-2 transition-all ${prefs.skin === s.id ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}
                  >
                    <s.icon size={13} /> {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => applyPrefs(DEFAULT_PREFS)} className="text-[11.5px] text-fog hover:text-ink transition-colors mt-4 underline underline-offset-4">
            Reset to studio defaults
          </button>
          <p className="text-[11.5px] text-fog/80 mt-4 leading-relaxed">
            Applied at creation time — set the tone once, every new study starts on brand. Headline voice stays{' '}
            {HEADING_FONTS[0].name} by default.
          </p>
        </section>

        {/* data */}
        <section className="glass rounded-2xl bg-white p-6 md:p-7">
          <div className="flex items-center gap-2.5 mb-4">
            <ShieldCheck size={15} className="text-lime-deep" />
            <h2 className="font-display font-semibold">Data & privacy</h2>
          </div>
          <div className="flex flex-col gap-3 text-[13px] text-ink/80">
            <p className="flex items-start gap-2.5">
              <Check size={13} className="text-sage-deep mt-1 shrink-0" />
              Studies are unlisted by default — only people with the link can open them.
            </p>
            <p className="flex items-start gap-2.5">
              <Check size={13} className="text-sage-deep mt-1 shrink-0" />
              Shared links and embeds re-render instantly on every edit.
            </p>
            <p className="flex items-start gap-2.5">
              <Check size={13} className="text-sage-deep mt-1 shrink-0" />
              Crawls fetch public pages only; nothing private is ever requested.
            </p>
          </div>
        </section>

        <p className="text-center text-[11px] font-mono text-fog/70">
          Vistara Studio · Vite + React + TypeScript · Tailwind CSS · Framer Motion · Supabase (PostgreSQL) on Vercel
        </p>
      </main>
    </div>
  );
}
