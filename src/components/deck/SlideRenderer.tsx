import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Layers, Zap, ShieldCheck, Cpu, BarChart3, Check, ArrowRight, Globe,
} from 'lucide-react';
import type { Slide } from '../../types';
import { resolveTheme, SECTION_LABELS, type ResolvedTheme } from '../../lib/themes';
import { EditableText } from '../ui';
import { validateSlideData, safeRender } from '../../lib/reactSafety';

// ---------------------------------------------------------------- helpers

export function Title({ text, t, style, className = '' }: { text: string; t: ResolvedTheme; style?: React.CSSProperties; className?: string }) {
  const parts = (text || '').split('*');
  return (
    <span className={className} style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            style={{
              background: `linear-gradient(95deg, ${t.accent} 10%, ${t.accent2} 90%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

const FEATURE_ICONS = [Sparkles, Layers, Zap, ShieldCheck, Cpu, BarChart3];

function animClass(slide: Slide, animate: boolean, i = 0) {
  if (!animate || !slide.animation || slide.animation === 'none') return {};
  const base =
    slide.animation === 'zoom' ? 'anim-zoom' :
    slide.animation === 'slide' ? 'anim-slide' :
    slide.animation === 'scale' ? 'anim-scale' :
    slide.animation === 'blur' ? 'anim-blur' :
    slide.animation === 'mask' ? 'anim-mask' :
    slide.animation === 'cinematic' ? 'anim-cinematic' :
    slide.animation === 'fade' ? 'anim-fade' :
    slide.animation === 'stagger' ? 'anim-rise' : 'anim-rise';
  return { className: base, style: { animationDelay: `${0.06 + i * 0.08}s` } as React.CSSProperties };
}


function splitBullet(b: string): [string, string] {
  const idx = b.indexOf(' — ');
  if (idx === -1) return [b, ''];
  return [b.slice(0, idx), b.slice(idx + 3)];
}

// Browser chrome frame for screenshots
export function BrowserFrame({ src, t, small = false, url }: { src: string; t: ResolvedTheme; small?: boolean; url?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: `linear-gradient(140deg, ${t.panel}, ${t.panel2})`, border: `1px solid ${t.line}`, borderRadius: 14 }}
      >
        <Globe size={small ? 18 : 40} style={{ color: t.muted }} />
      </div>
    );
  }
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        borderRadius: small ? 8 : 14,
        border: `1px solid ${t.line}`,
        background: t.panel,
        boxShadow: small ? 'none' : `0 40px 90px -30px rgba(0,0,0,0.6), 0 0 60px -20px ${t.accent}44`,
      }}
    >
      <div className="flex items-center gap-1" style={{ padding: small ? '4px 8px' : '10px 14px', borderBottom: `1px solid ${t.line}` }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <span key={c} className="rounded-full" style={{ width: small ? 5 : 9, height: small ? 5 : 9, background: c, opacity: 0.85 }} />
        ))}
        {!small && (
          <span className="ml-3 flex-1 min-w-0 text-center truncate" style={{ fontSize: 11, color: t.muted, fontFamily: t.bodyFont }}>
            {url || (src.startsWith('data:') ? 'Live Captured Snapshot' : src.replace(/^https?:\/\/(image\.thum\.io\/get\/[^/]+\/(crop\/[^/]+\/)?)?/, ''))}
          </span>
        )}
      </div>
      <img src={src} alt="Website screenshot" className="w-full object-cover object-top" style={{ height: 'calc(100% - 30px)' }} onError={() => setFailed(true)} />
    </div>
  );
}

// ---------------------------------------------------------------- renderer

interface RenderProps {
  slide: Slide;
  theme?: Partial<import('../../types').DeckTheme> | null;
  index?: number;
  total?: number;
  animate?: boolean;
  chrome?: boolean;
  onField?: (key: 'title' | 'subtitle' | 'body', v: string) => void;
  onBullet?: (i: number, v: string) => void;
}

export function SlideRenderer({ slide: inputSlide, theme, index = 0, total = 0, animate = false, chrome = true, onField, onBullet }: RenderProps) {
  const safeSlide = validateSlideData(inputSlide);
  const slide = {
    ...inputSlide,
    title: safeRender(safeSlide.title, ''),
    subtitle: safeRender(safeSlide.subtitle, ''),
    body: safeRender(safeSlide.body, ''),
    bullets: Array.isArray(safeSlide.bullets) ? safeSlide.bullets.map((value) => safeRender(value, '')) : [],
    stats: Array.isArray(safeSlide.stats) ? safeSlide.stats : [],
    image_url: typeof safeSlide.image_url === 'string' ? safeSlide.image_url : null,
    layout: safeRender(safeSlide.layout, 'center') as Slide['layout'],
    animation: safeRender(safeSlide.animation, 'fade') as Slide['animation'],
  } as Slide;
  const t = resolveTheme(theme, slide.theme_override);
  const editable = !!onField;
  const kicker = slide.custom_label || SECTION_LABELS[slide.type] || 'Section';
  const bullets = slide.bullets || [];
  const stats = slide.stats || [];

  const ed = (key: 'title' | 'subtitle' | 'body', v: string) => onField?.(key, v);

  const TitleBlock = ({ size, center }: { size: number; center?: boolean }) => (
    <div className={center ? 'text-center' : ''}>
      {editable ? (
        <EditableText
          value={(slide.title || '').replace(/\*/g, '')}
          onCommit={(v) => {
            const words = v.split(/\s+/);
            ed('title', words.length > 1 ? `${words.slice(0, -1).join(' ')} *${words[words.length - 1]}*` : v);
          }}
          multiline
          className="font-semibold"
          style={{ fontFamily: t.headingFont, fontSize: size, lineHeight: 1.06, color: t.text, letterSpacing: '-0.02em' }}
        />
      ) : (
        <div style={{ fontFamily: t.headingFont, fontSize: size, lineHeight: 1.06, color: t.text, letterSpacing: '-0.02em', fontWeight: t.headingFont === 'Instrument Serif' ? 400 : 600 }}>
          <Title text={slide.title || ''} t={t} />
        </div>
      )}
      {(slide.subtitle || editable) && (
        <div className="mt-4">
          {editable ? (
            <EditableText value={slide.subtitle || ''} onCommit={(v) => ed('subtitle', v)} multiline style={{ fontSize: size * 0.32, color: t.muted, fontFamily: t.bodyFont, lineHeight: 1.5 }} />
          ) : (
            <p style={{ fontSize: size * 0.32, color: t.muted, fontFamily: t.bodyFont, lineHeight: 1.5 }}>{slide.subtitle}</p>
          )}
        </div>
      )}
    </div>
  );

  const Body = ({ center, maxW }: { center?: boolean; maxW?: number }) =>
    slide.body || editable ? (
      editable ? (
        <EditableText value={slide.body || ''} onCommit={(v) => ed('body', v)} multiline className={center ? 'text-center' : ''} style={{ fontSize: 17, color: t.muted, lineHeight: 1.75, fontFamily: t.bodyFont, maxWidth: maxW, margin: center ? '0 auto' : undefined }} />
      ) : (
        <p className={center ? 'text-center' : ''} style={{ fontSize: 17, color: t.muted, lineHeight: 1.75, fontFamily: t.bodyFont, maxWidth: maxW, margin: center ? '0 auto' : undefined }}>
          {slide.body}
        </p>
      )
    ) : null;

  const BulletText = ({ i, b, style, className = '' }: { i: number; b: string; style?: React.CSSProperties; className?: string }) =>
    onBullet ? (
      <EditableText value={b.replace(' — ', ' — ')} onCommit={(v) => onBullet(i, v)} multiline style={style} className={className} />
    ) : (
      <span style={style} className={className}>{b}</span>
    );

  const renderBody = () => {
    // purpose-driven business sections reuse battle-tested compositions
    const as = ({ market: 'intro', differentiation: 'problem', businessValue: 'benefits', growth: 'future', implementation: 'architecture', impact: 'benefits' } as Record<string, string>)[slide.type] || slide.type;
    switch (as) {
      case 'hero': {
        if (slide.layout === 'center' || !slide.image_url) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center px-16">
              <div {...animClass(slide, animate, 0)} className={`flex gap-2 mb-8 flex-wrap justify-center ${animClass(slide, animate, 0).className || ''}`} style={animClass(slide, animate, 0).style}>
                {stats.map((s, i) => (
                  <span key={i} className="px-3.5 py-1.5 rounded-full text-[11px] font-medium tracking-wide" style={{ border: `1px solid ${t.line}`, background: `${t.panel}CC`, color: t.muted, fontFamily: t.bodyFont }}>
                    <span style={{ color: t.accent }}>{s.value}</span>&nbsp;&nbsp;{s.label}
                  </span>
                ))}
              </div>
              <div {...animClass(slide, animate, 1)} className={animClass(slide, animate, 1).className} style={animClass(slide, animate, 1).style}>
                <TitleBlock size={76} center />
              </div>
              <div className="mt-7 max-w-2xl" {...animClass(slide, animate, 2)} style={animClass(slide, animate, 2).style}>
                <Body center maxW={640} />
              </div>
            </div>
          );
        }
        return (
          <div className="h-full grid grid-cols-[1.05fr_0.95fr] items-center gap-14 px-16">
            <div className="flex flex-col gap-6">
              <div {...animClass(slide, animate, 0)} style={animClass(slide, animate, 0).style}>
                <TitleBlock size={64} />
              </div>
              <div {...animClass(slide, animate, 1)} style={animClass(slide, animate, 1).style}>
                <Body maxW={480} />
              </div>
              <div className="flex gap-2.5 flex-wrap" {...animClass(slide, animate, 2)} style={animClass(slide, animate, 2).style}>
                {stats.map((s, i) => (
                  <span key={i} className="px-3.5 py-1.5 rounded-full text-[11px] font-medium tracking-wide" style={{ border: `1px solid ${t.line}`, background: `${t.panel}CC`, color: t.muted }}>
                    <span style={{ color: t.accent }}>{s.value}</span>&nbsp;&nbsp;{s.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative h-[420px]" {...animClass(slide, animate, 1)} style={animClass(slide, animate, 1).style}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(closest-side, ${t.accent}33, transparent)`, filter: 'blur(40px)', transform: 'scale(1.2)' }} />
              <div className="relative h-full" style={{ transform: 'perspective(1200px) rotateY(-7deg) rotateX(2deg)' }}>
                <BrowserFrame src={slide.image_url} t={t} />
              </div>
            </div>
          </div>
        );
      }

      case 'intro':
        return (
          <div className="h-full grid grid-cols-[1.1fr_0.9fr] gap-16 items-center px-16">
            <div className="flex flex-col gap-6">
              <TitleBlock size={52} />
              <Body maxW={520} />
              {bullets.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {bullets.slice(0, 3).map((b, i) => {
                    const [bt, bd] = splitBullet(b);
                    return (
                      <div key={i} className="flex items-baseline gap-3" {...animClass(slide, animate, i + 1)} style={animClass(slide, animate, i + 1).style}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 translate-y-[-2px]" style={{ background: t.accent }} />
                        <span style={{ fontSize: 14, fontFamily: t.bodyFont }}>
                          <span style={{ color: t.accent, fontWeight: 600 }}><BulletText i={i} b={bt} style={{}} /></span>
                          {bd && <span style={{ color: t.muted }}> — {bd}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {stats.map((s, i) => (
                <div key={i} className="p-6" style={{ background: `${t.panel}${t.skin === 'dark' ? '' : ''}`, border: `1px solid ${t.line}`, borderRadius: t.radius, ...(animClass(slide, animate, i + 1).style || {}) }} {...animClass(slide, animate, i + 1)}>
                  <div style={{ fontSize: 24, fontFamily: t.headingFont, color: t.text, fontWeight: 600 }}>{s.value}</div>
                  <div className="mt-1 uppercase" style={{ fontSize: 10, letterSpacing: '0.22em', color: t.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'problem':
        return (
          <div className="h-full flex flex-col justify-center px-16 gap-12">
            <TitleBlock size={48} />
            <div className="grid grid-cols-3 gap-5">
              {bullets.slice(0, 3).map((b, i) => {
                const [bt, bd] = splitBullet(b);
                return (
                  <div key={i} className="p-7 flex flex-col gap-4 relative overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                    <span style={{ fontFamily: t.headingFont, fontSize: 15, color: t.accent, fontWeight: 600 }}>0{i + 1}</span>
                    <div style={{ fontSize: 20, fontFamily: t.headingFont, color: t.text, fontWeight: 600, lineHeight: 1.25 }}>
                      <BulletText i={i} b={bt} />
                    </div>
                    {bd && <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6 }}>{bd}</p>}
                    <div className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full" style={{ background: `${t.accent}14`, filter: 'blur(24px)' }} />
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'solution': {
        const vd = (slide as unknown as Record<string, unknown>).visualDecision as Record<string, unknown> | undefined;
        return (
          <div className="h-full grid grid-cols-2 gap-14 items-center px-16">
            <div className="flex flex-col gap-6">
              <TitleBlock size={50} />
              <Body maxW={460} />
              <div className="flex items-center gap-2 mt-1" style={{ color: t.accent }}>
                <ArrowRight size={16} />
                <span style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: t.bodyFont }}>The alternative, live today</span>
              </div>
            </div>
            {slide.image_url ? (
              <div className="relative h-[380px] rounded-2xl overflow-hidden shadow-2xl" style={{ border: `1px solid ${t.line}`, background: t.panel }}>
                <img src={slide.image_url} alt={slide.title || 'Solution visual'} className="w-full h-full object-cover" />
                {vd?.attribution && typeof vd.attribution === 'object' && (vd.attribution as Record<string, string>).author ? (
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md text-[10px] backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.65)', color: '#FFFFFF' }}>
                    Photo by {String((vd.attribution as Record<string, string>).author)} / {String((vd.attribution as Record<string, string>).provider || 'Unsplash')}
                  </div>
                ) : null}
              </div>
            ) : (


              <div className="p-8 flex flex-col gap-5" style={{ background: `linear-gradient(150deg, ${t.accent}18, ${t.panel})`, border: `1px solid ${t.accent}44`, borderRadius: t.radius }}>
                <div className="uppercase" style={{ fontSize: 10, letterSpacing: '0.26em', color: t.accent }}>Why it stands apart</div>
                {bullets.slice(0, 4).map((b, i) => (
                  <div key={i} className="flex gap-3.5 items-start" {...animClass(slide, animate, i)} style={animClass(slide, animate, i).style}>
                    <span className="mt-0.5 shrink-0 rounded-full flex items-center justify-center" style={{ width: 20, height: 20, background: `${t.accent}26`, border: `1px solid ${t.accent}66` }}>
                      <Check size={11} style={{ color: t.accent }} />
                    </span>
                    <BulletText i={i} b={b} style={{ fontSize: 15, color: t.text, lineHeight: 1.6, fontFamily: t.bodyFont }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }


      case 'features':
        return (
          <div className="h-full flex flex-col justify-center px-16 gap-10">
            <TitleBlock size={46} />
            <div className="grid grid-cols-3 gap-5">
              {bullets.slice(0, 6).map((b, i) => {
                const [bt, bd] = splitBullet(b);
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
                return (
                  <div key={i} className="p-6 flex flex-col gap-3" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                    <span className="rounded-xl flex items-center justify-center" style={{ width: 40, height: 40, background: `linear-gradient(140deg, ${t.accent}30, ${t.accent2}22)`, border: `1px solid ${t.accent}40` }}>
                      <Icon size={17} style={{ color: t.accent }} />
                    </span>
                    <div style={{ fontSize: 17, fontFamily: t.headingFont, color: t.text, fontWeight: 600, lineHeight: 1.3 }}>
                      <BulletText i={i} b={bt} />
                    </div>
                    {bd && <p style={{ fontSize: 12.5, color: t.muted, lineHeight: 1.6 }}>{bd}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'workflow':
        return (
          <div className="h-full flex flex-col justify-center px-16 gap-14">
            <div className="text-center mx-auto"><TitleBlock size={46} center /></div>
            <div className="grid grid-cols-4 gap-0 relative">
              <div className="absolute top-7 left-[12%] right-[12%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}55, ${t.accent2}55, transparent)` }} />
              {bullets.slice(0, 4).map((b, i) => {
                const [bt, bd] = splitBullet(b);
                return (
                  <div key={i} className="flex flex-col items-center text-center gap-4 px-4 relative" {...animClass(slide, animate, i)} style={animClass(slide, animate, i).style}>
                    <span className="rounded-full flex items-center justify-center font-semibold relative z-10" style={{ width: 56, height: 56, fontFamily: t.headingFont, fontSize: 18, color: t.accent, background: t.panel, border: `1px solid ${t.accent}55`, boxShadow: `0 0 34px -6px ${t.accent}55` }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div style={{ fontSize: 18, fontFamily: t.headingFont, color: t.text, fontWeight: 600 }}>
                      <BulletText i={i} b={bt} />
                    </div>
                    {bd && <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>{bd}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'architecture':
        return (
          <div className="h-full grid grid-cols-[0.85fr_1.15fr] gap-16 items-center px-16">
            <div className="flex flex-col gap-6">
              <TitleBlock size={46} />
              {stats.length > 0 && (
                <div className="flex gap-3 mt-2">
                  {stats.map((s, i) => (
                    <div key={i} className="px-5 py-4" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius }}>
                      <div style={{ fontSize: 20, fontFamily: t.headingFont, color: t.accent, fontWeight: 600 }}>{s.value}</div>
                      <div className="uppercase mt-0.5" style={{ fontSize: 9, letterSpacing: '0.2em', color: t.muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3.5">
              {bullets.slice(0, 4).map((b, i) => {
                const [bt, bd] = splitBullet(b);
                return (
                  <div key={i} className="flex items-center gap-6 p-5" style={{ background: `linear-gradient(90deg, ${t.accent}${14 - i * 3 > 0 ? 14 - i * 3 : 6}, transparent 70%), ${t.panel}`, border: `1px solid ${t.line}`, borderRadius: t.radius * 0.8, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                    <span className="uppercase shrink-0 w-40" style={{ fontSize: 11, letterSpacing: '0.16em', color: t.accent, fontWeight: 600 }}>
                      <BulletText i={i} b={bt} />
                    </span>
                    <span style={{ fontSize: 15, color: t.text, fontFamily: t.bodyFont }}>{bd}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'benefits':
        return (
          <div className="h-full flex flex-col justify-center px-16 gap-12">
            <div className="text-center mx-auto"><TitleBlock size={48} center /></div>
            <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.min(4, stats.length || 3))}, 1fr)` }}>
              {stats.slice(0, 4).map((s, i) => (
                <div key={i} className="text-center p-8 relative overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                  <div style={{ fontFamily: t.headingFont, fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em', background: `linear-gradient(120deg, ${t.text} 30%, ${t.accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                    {s.value}
                  </div>
                  <div className="mt-2 uppercase" style={{ fontSize: 10.5, letterSpacing: '0.2em', color: t.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="max-w-2xl mx-auto"><Body center /></div>
          </div>
        );

      case 'technology':
        return (
          <div className="h-full grid grid-cols-[0.9fr_1.1fr] gap-16 items-center px-16">
            <div className="flex flex-col gap-6">
              <TitleBlock size={46} />
              <Body maxW={420} />
            </div>
            <div className="flex flex-wrap gap-3 content-center">
              {bullets.map((b, i) => {
                const [bt, bd] = splitBullet(b);
                return (
                  <span key={i} className="inline-flex items-baseline gap-2 px-5 py-3" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: 999, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                    <span style={{ fontSize: 16, color: t.text, fontFamily: t.headingFont, fontWeight: 600 }}>
                      <BulletText i={i} b={bt} />
                    </span>
                    {bd && <span style={{ fontSize: 11, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{bd}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        );

      case 'future':
        return (
          <div className="h-full flex flex-col justify-center px-20 gap-10">
            <TitleBlock size={48} />
            <div className="relative pl-2">
              <div className="absolute left-[13px] top-2 bottom-2 w-px" style={{ background: `linear-gradient(180deg, ${t.accent}88, ${t.accent2}33)` }} />
              <div className="flex flex-col gap-7">
                {bullets.slice(0, 4).map((b, i) => {
                  const [bt, bd] = splitBullet(b);
                  return (
                    <div key={i} className="flex gap-7 items-baseline relative" {...animClass(slide, animate, i)} style={animClass(slide, animate, i).style}>
                      <span className="rounded-full shrink-0 relative z-10" style={{ width: 11, height: 11, background: t.accent, boxShadow: `0 0 16px ${t.accent}`, marginTop: 6, marginLeft: 3 }} />
                      <div>
                        <span style={{ fontSize: 21, fontFamily: t.headingFont, color: t.text, fontWeight: 600 }}>
                          <BulletText i={i} b={bt} />
                        </span>
                        {bd && <span style={{ fontSize: 14.5, color: t.muted }}> — {bd}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'cta': {
        const host = stats[0]?.value || '';
        return (
          <div className="h-full flex flex-col items-center justify-center text-center px-16 relative">
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 45% at 50% 55%, ${t.accent}26, transparent)`, filter: 'blur(10px)' }} />
            <div className="relative flex flex-col items-center gap-8">
              <div {...animClass(slide, animate, 0)} style={animClass(slide, animate, 0).style}>
                <TitleBlock size={66} center />
              </div>
              <div {...animClass(slide, animate, 1)} style={animClass(slide, animate, 1).style}>
                <Body center maxW={560} />
              </div>
              {host && (
                <div className="inline-flex items-center gap-3 px-8 py-4" style={{ background: `linear-gradient(100deg, ${t.accent}, ${t.accent2})`, borderRadius: 999, boxShadow: `0 20px 60px -16px ${t.accent}88`, ...animClass(slide, animate, 2).style }} {...animClass(slide, animate, 2)}>
                  <Globe size={17} style={{ color: t.skin === 'dark' ? '#0B0B12' : '#fff' }} />
                  <span style={{ fontSize: 17, fontWeight: 600, color: t.skin === 'dark' ? '#0B0B12' : '#fff', fontFamily: t.headingFont }}>{host}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      default: {
        // custom / generic
        if (slide.layout === 'center') {
          return (
            <div className="h-full flex flex-col items-center justify-center text-center px-16 gap-7">
              <TitleBlock size={52} center />
              <Body center maxW={640} />
              {bullets.length > 0 && (
                <div className="flex gap-3 flex-wrap justify-center max-w-3xl">
                  {bullets.map((b, i) => (
                    <span key={i} className="px-4 py-2.5" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius * 0.7, fontSize: 14, color: t.text }}>
                      <BulletText i={i} b={b} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (slide.layout === 'grid') {
          return (
            <div className="h-full flex flex-col justify-center px-16 gap-10">
              <TitleBlock size={46} />
              <div className="grid grid-cols-3 gap-5">
                {bullets.slice(0, 6).map((b, i) => {
                  const [bt, bd] = splitBullet(b);
                  return (
                    <div key={i} className="p-6" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                      <div style={{ fontSize: 17, fontFamily: t.headingFont, color: t.text, fontWeight: 600 }}>
                        <BulletText i={i} b={bt} />
                      </div>
                      {bd && <p className="mt-2" style={{ fontSize: 13, color: t.muted, lineHeight: 1.6 }}>{bd}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <div className="h-full grid grid-cols-[1fr_1fr] gap-16 items-center px-16">
            <div className="flex flex-col gap-6">
              <TitleBlock size={48} />
              <Body maxW={480} />
            </div>
            <div className="flex flex-col gap-3.5">
              {bullets.slice(0, 5).map((b, i) => {
                const [bt, bd] = splitBullet(b);
                return (
                  <div key={i} className="flex gap-4 items-start p-5" style={{ background: t.panel, border: `1px solid ${t.line}`, borderRadius: t.radius * 0.8, ...animClass(slide, animate, i).style }} {...animClass(slide, animate, i)}>
                    <span style={{ fontFamily: t.headingFont, fontSize: 13, color: t.accent, fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <span style={{ fontSize: 15.5, color: t.text, fontWeight: 600, fontFamily: t.headingFont }}>
                        <BulletText i={i} b={bt} />
                      </span>
                      {bd && <span style={{ fontSize: 14, color: t.muted }}> — {bd}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: t.bg, borderRadius: 12, fontFamily: t.bodyFont }}
    >
      {/* ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 w-[560px] h-[420px]" style={{ background: `radial-gradient(closest-side, ${t.accent}${t.skin === 'dark' ? '1f' : '14'}, transparent)`, filter: 'blur(28px)' }} />
        <div className="absolute -bottom-36 -right-24 w-[520px] h-[400px]" style={{ background: `radial-gradient(closest-side, ${t.accent2}${t.skin === 'dark' ? '16' : '10'}, transparent)`, filter: 'blur(28px)' }} />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${t.line} 1px, transparent 1px), linear-gradient(90deg, ${t.line} 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            opacity: 0.35,
            maskImage: 'radial-gradient(ellipse 80% 70% at 60% 30%, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 60% 30%, black 20%, transparent 70%)',
          }}
        />
      </div>

      {/* kicker */}
      {chrome && (
        <div className="absolute top-9 left-16 flex items-center gap-2.5 z-10">
          <span className="w-2 h-2 rounded-full" style={{ background: t.accent, boxShadow: `0 0 12px ${t.accent}` }} />
          <span className="uppercase" style={{ fontSize: 11, letterSpacing: '0.3em', color: t.muted, fontFamily: t.bodyFont, fontWeight: 600 }}>{kicker}</span>
        </div>
      )}

      <div className={`relative h-full ${chrome ? 'pt-10 pb-8' : ''}`}>{renderBody()}</div>

      {/* footer chrome */}
      {chrome && (
        <div className="absolute bottom-7 left-16 right-16 flex items-center justify-between z-10">
          <span style={{ fontSize: 10, letterSpacing: '0.26em', color: t.muted, textTransform: 'uppercase' }}>Vistara Studio</span>
          {total > 0 && (
            <span className="flex items-center gap-2" style={{ fontSize: 11, color: t.muted, fontFamily: t.bodyFont }}>
              <span style={{ color: t.accent, fontWeight: 600 }}>{String(index + 1).padStart(2, '0')}</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span>{String(total).padStart(2, '0')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- canvas (auto-scale)

export function SlideCanvas({
  slide,
  theme,
  index,
  total,
  animate = false,
  chrome = true,
  onField,
  onBullet,
  className = '',
}: RenderProps & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`w-full relative ${className}`} style={{ aspectRatio: '16 / 9' }}>
      <div className="absolute left-0 top-0" style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <SlideRenderer slide={slide} theme={theme} index={index} total={total} animate={animate} chrome={chrome} onField={onField} onBullet={onBullet} />
      </div>
    </div>
  );
}
