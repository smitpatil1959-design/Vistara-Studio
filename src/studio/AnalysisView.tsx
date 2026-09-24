import { motion } from 'framer-motion';
import { Clock, FileText, Gauge, HardDrive, Image as ImageIcon, Link2, Palette, Type, Cpu, Table2, Pipette } from 'lucide-react';
import type { Project } from '../types';
import { BrowserFrame } from '../components/deck/SlideRenderer';
import { resolveTheme } from '../lib/themes';
import { Pill, SectionHead } from '../components/ui';

function Metric({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-5 bg-white min-w-0">
      <div className="flex items-center gap-2 text-fog min-w-0">
        <Icon size={13} className="shrink-0" />
        <span className="text-[10px] uppercase tracking-[0.18em] truncate">{label}</span>
      </div>
      <p className="font-display text-xl md:text-2xl font-semibold mt-2 tracking-tight truncate" title={value}>{value}</p>
      {sub && <p className="text-[11px] text-fog mt-1 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

export default function AnalysisView({ project, onUseAccent }: { project: Project; onUseAccent: (hex: string) => Promise<void> }) {
  const a = project.analysis!;
  const t = resolveTheme(project.theme);
  const goodLinks = a.links.probed.filter((l) => l.ok).length;
  const badLinks = a.links.probed.filter((l) => !l.ok);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-10 pb-10">
      {/* hero strip — clamped grid: preview can never push the rail off-viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="glass rounded-3xl p-4 noise bg-white min-w-0 overflow-hidden w-full max-w-full">
          <div className="aspect-[16/9] rounded-2xl overflow-hidden hairline">
            <BrowserFrame src={a.screenshot} t={t} url={a.finalUrl || a.url} />
          </div>
          <div className="flex items-center justify-between px-2 pt-3.5 pb-1 gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold truncate">{a.title || project.name}</p>
              <p className="text-[12px] text-fog truncate mt-0.5">{a.description || a.url}</p>
            </div>
            <Pill tone="accent">HTTP {a.status}</Pill>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <Metric icon={Clock} label="Response" value={`${a.loadMs} ms`} sub="time to full HTML" />
          <Metric icon={HardDrive} label="Document" value={`${a.sizeKb} KB`} sub="transfer payload" />
          <Metric icon={FileText} label="Pages mapped" value={`${a.pages.length}`} sub={`${a.pages.reduce((s, p) => s + p.words, 0).toLocaleString()} words read`} />
          <Metric icon={Link2} label="Links probed" value={`${goodLinks}/${a.links.probed.length}`} sub={badLinks.length ? `${badLinks.length} broken` : 'all healthy'} />
          <div className="col-span-2 glass rounded-2xl p-5 flex items-center gap-4 bg-lime-soft">
            <Gauge size={20} className="text-lime-deep shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Audit verdict: <span className="font-display font-semibold text-lime-deep">{project.audit?.overall}/100</span>
              </p>
              <p className="text-[12px] text-ink/60 truncate mt-0.5">{project.audit?.verdict}</p>
            </div>
          </div>
        </div>
      </div>

      {/* design tokens */}
      <section>
        <SectionHead kicker="Extracted design tokens" title="Palette, type & technology" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 bg-white">
            <div className="flex items-center gap-2 text-fog mb-4">
              <Palette size={13} /> <span className="text-[10px] uppercase tracking-[0.2em]">Palette · found in CSS</span>
            </div>
            {a.colors.length === 0 && <p className="text-fog text-sm">No saturated colors found in inline styles — the palette likely lives in compiled CSS.</p>}
            <div className="flex flex-wrap gap-2.5">
              {a.colors.map((c) => (
                <button key={c.hex} onClick={() => onUseAccent(c.hex)} title="Use as deck accent" className="group relative">
                  <span className="block w-12 h-12 rounded-xl hairline transition-transform group-hover:scale-110" style={{ background: c.hex }} />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pipette size={14} className="text-white drop-shadow" />
                  </span>
                  <span className="block text-[9px] font-mono text-fog mt-1.5 text-center">{c.hex}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-fog/80 mt-3.5">Click a swatch to set it as the deck accent.</p>
          </div>
          <div className="glass rounded-2xl p-5 bg-white">
            <div className="flex items-center gap-2 text-fog mb-4">
              <Type size={13} /> <span className="text-[10px] uppercase tracking-[0.2em]">Typography</span>
            </div>
            {a.fonts.length === 0 && <p className="text-fog text-sm">System font stack — no custom faces detected.</p>}
            <div className="flex flex-col gap-2.5">
              {a.fonts.map((f) => (
                <div key={f} className="flex items-center justify-between hairline rounded-xl px-4 py-2.5 bg-panel2">
                  <span className="text-sm">{f}</span>
                  <span className="text-[10px] font-mono text-fog">webfont</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl p-5 bg-white">
            <div className="flex items-center gap-2 text-fog mb-4">
              <Cpu size={13} /> <span className="text-[10px] uppercase tracking-[0.2em]">Detected stack</span>
            </div>
            {a.tech.length === 0 && <p className="text-fog text-sm">No recognizable fingerprints — likely a hand-rolled stack.</p>}
            <div className="flex flex-wrap gap-2">
              {a.tech.map((tch) => (
                <span key={tch.name} className="inline-flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-full hairline bg-panel2">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-deep" />
                  {tch.name}
                  <span className="text-fog text-[10px]">{tch.category}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* pages table */}
      <section>
        <SectionHead kicker="Crawl map" title="Pages discovered" right={<Pill>{a.pages.length} documents</Pill>} />
        <div className="glass rounded-2xl overflow-hidden bg-white">
          <div className="grid grid-cols-[1fr_2fr_70px_70px_90px_90px] gap-3 px-5 py-3 border-b border-line text-[10px] font-mono uppercase tracking-[0.18em] text-fog bg-panel2 max-md:hidden">
            <span>Path</span>
            <span>Title</span>
            <span className="text-right flex items-center justify-end gap-1"><ImageIcon size={10} /> img</span>
            <span className="text-right flex items-center justify-end gap-1"><Link2 size={10} /> links</span>
            <span className="text-right">Words</span>
            <span className="text-right">Status</span>
          </div>
          {a.pages.map((p) => (
            <div key={p.url} className="grid md:grid-cols-[1fr_2fr_70px_70px_90px_90px] gap-3 px-5 py-3.5 border-b border-line/60 last:border-0 items-center max-md:grid-cols-2">
              <span className="font-mono text-[12px] text-sage-deep truncate">{p.path}</span>
              <span className="text-[13px] text-ink/85 truncate">{p.title || p.h1 || '—'}</span>
              <span className="text-right max-md:text-left text-[12px] text-fog font-mono">{p.images}</span>
              <span className="text-right max-md:text-left text-[12px] text-fog font-mono">{p.links}</span>
              <span className="text-right max-md:text-left text-[12px] text-fog font-mono">{p.words.toLocaleString()}</span>
              <span className="text-right max-md:text-left">
                <Pill tone={p.status === 200 ? 'success' : 'fail'}>{p.status}</Pill>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* runtime capture: browser evidence */}
      <section>
        <SectionHead
          kicker="Runtime capture"
          title="How the site was read"
          right={
            <Pill tone={a.captureMode === 'browser' ? 'accent' : 'default'}>
              {a.captureMode === 'browser' ? 'Real browser render' : 'Document scan'}
            </Pill>
          }
        />
        <div className="grid lg:grid-cols-3 gap-4">
          {/* redirect chain */}
          <div className="glass rounded-2xl p-5 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-4">Redirect chain</p>
            {(a.redirects ?? []).length === 0 && <p className="text-fog text-sm">No redirects — the target answered directly.</p>}
            {(a.redirects ?? []).map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[12px] py-1.5 min-w-0">
                <Pill tone={r.status < 400 ? 'success' : 'fail'}>{r.status}</Pill>
                <span className="font-mono text-ink/70 truncate">{r.url.replace(/^https?:\/\//, '')}</span>
              </div>
            ))}
          </div>
          {/* console errors */}
          <div className="glass rounded-2xl p-5 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-4">
              Console errors{a.captureMode === 'browser' ? ` · ${(a.consoleErrors ?? []).length}` : ''}
            </p>
            {a.captureMode !== 'browser' ? (
              <p className="text-fog text-sm">Captured only in browser mode.</p>
            ) : (a.consoleErrors ?? []).length === 0 ? (
              <p className="text-sage-deep text-sm">Clean console — no script errors during render.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {(a.consoleErrors ?? []).map((c, i) => (
                  <p key={i} className="text-[11.5px] font-mono text-[#a2403a] bg-[#f9e3e0]/60 border border-[#ecc5c0] rounded-lg px-3 py-2 break-words">
                    {c.text}
                  </p>
                ))}
              </div>
            )}
          </div>
          {/* failed network requests */}
          <div className="glass rounded-2xl p-5 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-4">
              Failed requests{a.captureMode === 'browser' ? ` · ${(a.failedRequests ?? []).length}` : ''}
            </p>
            {a.captureMode !== 'browser' ? (
              <p className="text-fog text-sm">Captured only in browser mode.</p>
            ) : (a.failedRequests ?? []).length === 0 ? (
              <p className="text-sage-deep text-sm">Every request landed — nothing failed or was blocked.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {(a.failedRequests ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[11px] hairline rounded-lg px-3 py-2 bg-panel2">
                    <span className="font-mono text-[9px] uppercase text-[#b08a1e] shrink-0">{r.method}</span>
                    <span className="font-mono text-ink/70 truncate flex-1">{r.url}</span>
                    <span className="text-[#a2403a] text-[10px] font-mono shrink-0">{r.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* heading outline + link probe */}
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="glass rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-2 text-fog mb-4">
            <Table2 size={13} /> <span className="text-[10px] uppercase tracking-[0.2em]">Content outline · homepage</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
            {a.headings.length === 0 && <p className="text-fog text-sm">No headings detected.</p>}
            {a.headings.map((h, i) => (
              <div key={i} className="flex items-baseline gap-3 text-[13px]" style={{ paddingLeft: (h.level - 1) * 18 }}>
                <span className={`font-mono text-[10px] shrink-0 ${h.level === 1 ? 'text-lime-deep font-semibold' : h.level === 2 ? 'text-sage-deep' : 'text-fog'}`}>H{h.level}</span>
                <span className={h.level === 1 ? 'text-ink font-medium' : 'text-fog'}>{h.text}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="glass rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-2 text-fog mb-4">
            <Link2 size={13} /> <span className="text-[10px] uppercase tracking-[0.2em]">Link probe · live HEAD requests</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
            {a.links.probed.map((l, i) => {
              let short = l.url;
              try { short = new URL(l.url).hostname.replace(/^www\./, '') + new URL(l.url).pathname; } catch { /* keep */ }
              return (
                <div key={i} className="flex items-center gap-3 text-[12.5px] hairline rounded-lg px-3 py-2 bg-panel2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.ok ? 'bg-sage-deep' : 'bg-[#c4574e]'}`} />
                  <span className="font-mono truncate flex-1 text-ink/70">{short}</span>
                  <Pill tone={l.ok ? 'success' : 'fail'}>{l.status || 'down'}</Pill>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* extracted imagery */}
      {a.images.length > 0 && (
        <section>
          <SectionHead kicker="Media extraction" title="Imagery on the site" right={<Pill>{a.images.length} assets</Pill>} />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {a.images.map((img, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden group relative aspect-square bg-panel2">
                <img
                  src={img.src}
                  alt={img.alt || ''}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.08')}
                />
                <div className="absolute bottom-1.5 left-1.5">
                  <Pill tone={img.alt ? 'success' : 'warn'}>{img.alt ? 'alt' : 'no alt'}</Pill>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
