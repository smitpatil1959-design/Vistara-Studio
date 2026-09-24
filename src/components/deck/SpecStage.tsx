import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { PresentationSpec, SlideElement, SlideSpec } from '../../deck-spec';
import { Element } from './elements';
import { RenderContext, type RenderCtx } from './elements/context';
import { elementTransition, elementVariants, parallaxStyle, slideTransition } from './motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/* ------------------------------------------------------------ backgrounds */

function SlideBackgroundLayer({ spec, slide }: { spec: PresentationSpec; slide: SlideSpec }) {
  const { colors, effects } = spec.theme;
  const bg = slide.background || { type: 'theme', value: '' };
  const glowA = 0.2 * (effects.glowIntensity ?? 0.5);
  const glowB = 0.14 * (effects.glowIntensity ?? 0.5);
  const pad = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, '0');
  const hexA = (colors.accent || '#7C5CFF') + pad(glowA);
  const hexB = (colors.accent2 || '#22D3EE') + pad(glowB);

  let base: string = colors.bg;
  if (bg.type === 'solid' && bg.value) base = bg.value;

  return (
    <>
      <div className="absolute inset-0" style={{ background: bg.type === 'gradient' ? `linear-gradient(135deg, ${colors.bg}, ${colors.surfaceAlt})` : base }} />
      {bg.type === 'image' && bg.value && (
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      <div className="absolute -top-32 -left-24 w-[560px] h-[420px] pointer-events-none" style={{ background: `radial-gradient(closest-side, ${hexA}, transparent)`, filter: 'blur(28px)' }} />
      <div className="absolute -bottom-36 -right-24 w-[520px] h-[400px] pointer-events-none" style={{ background: `radial-gradient(closest-side, ${hexB}, transparent)`, filter: 'blur(28px)' }} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${colors.line} 1px, transparent 1px), linear-gradient(90deg, ${colors.line} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: 0.35,
          maskImage: 'radial-gradient(ellipse 80% 70% at 55% 30%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 55% 30%, black 20%, transparent 70%)',
        }}
      />
      {bg.overlay && <div className="absolute inset-0 pointer-events-none" style={{ background: bg.overlay }} />}
      {effects.grain && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.05,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ slot engine */

function bySlot(elements: SlideElement[], slot: string) {
  return elements.filter((e) => e.position.mode === 'flow' && e.position.slot === slot).sort((a, b) => (a.position.order ?? 0) - (b.position.order ?? 0));
}

interface CoreProps {
  spec: PresentationSpec;
  slide: SlideSpec;
  index: number;
  manualWaiting: boolean;
  onContinue: () => void;
}

function ComposedSlideCore({ spec, slide, index, manualWaiting, onContinue }: CoreProps) {
  const { theme } = spec;
  const reducedMotion = useReducedMotion();
  const kickers = bySlot(slide.elements, 'kicker');
  const titles = bySlot(slide.elements, 'title');
  const subtitles = bySlot(slide.elements, 'subtitle');
  const bodies = bySlot(slide.elements, 'body');
  const media = bySlot(slide.elements, 'media');
  const stats = bySlot(slide.elements, 'stat');
  const cards = bySlot(slide.elements, 'card');
  const actions = bySlot(slide.elements, 'action');
  const decorations = bySlot(slide.elements, 'decoration');
  const footers = bySlot(slide.elements, 'footer');
  const absolute = slide.elements.filter((e) => e.position.mode === 'absolute');

  const beefCards = manualWaiting ? [] : cards;
  const beefStats = manualWaiting ? [] : stats;
  const beefBodies = manualWaiting ? bodies.slice(0, 1) : bodies;

  const hasMedia = media.length > 0;
  const hasCards = beefCards.length > 0;
  const hasStats = beefStats.length > 0;
  const center = slide.layout === 'center' || slide.section === 'cta';
  const isSplit = hasMedia || (hasCards && (slide.layout === 'left' || slide.layout === 'split'));
  const cardCols = isSplit
    ? (beefCards.length <= 3 ? 1 : 2)
    : (beefCards.length <= 1 ? 1 : beefCards.length === 2 ? 2 : beefCards.length <= 4 ? 2 : 3);

  const textCol = (extra?: React.CSSProperties) => (
    <div className={`flex flex-col ${center ? 'items-center text-center' : ''}`} style={{ gap: theme.spacing.unit * 2.4, ...extra }}>
      {kickers.map((e, i) => <Element key={e.id} element={e} staggerBase={i * 0.4} />)}
      {titles.map((e) => <Element key={e.id} element={e} staggerBase={0.8} />)}
      {subtitles.map((e) => <Element key={e.id} element={e} staggerBase={1.6} />)}
      {beefBodies.map((e) => <Element key={e.id} element={e} staggerBase={2.2} />)}
      {actions.length > 0 && (
        <div className={`flex gap-3 flex-wrap ${center ? 'justify-center' : ''}`}>
          {actions.map((e, i) => <Element key={e.id} element={e} staggerBase={3 + i * 0.4} />)}
        </div>
      )}
    </div>
  );

  const statRow = hasStats ? (
    <div className={`flex gap-3.5 flex-wrap ${center ? 'justify-center' : ''}`}>
      {beefStats.slice(0, 4).map((e, i) => (
        <div key={e.id} style={{ flex: '1 1 0', minWidth: 140 }}>
          <Element element={e} staggerBase={2.6 + i * 0.5} />
        </div>
      ))}
    </div>
  ) : null;

  const cardGrid = hasCards ? (
    <div className="grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${cardCols}, minmax(0,1fr))`, gap: theme.spacing.cardGap }}>
      {beefCards.map((e, i) => (
        <Element key={e.id} element={e} staggerBase={2.8 + i * 0.55} />
      ))}
    </div>
  ) : null;

  const mediaCol = hasMedia ? (
    <div className="relative min-w-0 h-full flex items-center overflow-hidden" style={{ flex: 1 }}>
      {media.map((e, i) => (
        <div key={e.id} className="w-full" style={{ height: '100%', ...(parallaxStyle(spec.motion.parallax, reducedMotion, window.innerWidth) || {}), }} data-motion="animated">
          <Element element={e} staggerBase={1.4 + i * 0.4} />
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: theme.radius.md, fontFamily: `'${theme.typography.bodyFont}', sans-serif` }}>
      <SlideBackgroundLayer spec={spec} slide={slide} />

      {decorations.map((e) => (
        <Element key={e.id} element={e} />
      ))}

      <div
        className="relative h-full flex flex-col overflow-hidden"
        style={{ padding: `${theme.spacing.sectionGap}px ${theme.spacing.sectionGap + 16}px`, gap: theme.spacing.unit * 3.4 }}
      >
        {center ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden" style={{ gap: theme.spacing.unit * 3 }}>
            {textCol({ maxWidth: 780 })}
            {statRow}
            {cardGrid}
            {mediaCol && <div className="w-full max-w-xl" style={{ height: 300 }}>{mediaCol}</div>}
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid gap-10 items-center overflow-hidden" style={{ gridTemplateColumns: isSplit ? 'minmax(0,1.05fr) minmax(0,0.95fr)' : 'minmax(0,1fr)' }}>
            <div className="flex flex-col min-h-0 justify-center overflow-hidden" style={{ gap: theme.spacing.unit * 3 }}>
              {textCol()}
              {statRow}
              {!isSplit && cardGrid}
            </div>
            {isSplit && (
              <div className="flex flex-col min-h-0 justify-center overflow-hidden" style={{ gap: theme.spacing.cardGap }}>
                {mediaCol}
                {cardGrid}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between shrink-0" style={{ borderTop: `1px solid ${theme.colors.line}`, paddingTop: theme.spacing.unit * 1.6 }}>
          <div className="flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.26em', color: theme.colors.muted, textTransform: 'uppercase' }}>
            {footers.length ? footers.map((e) => <Element key={e.id} element={e} />) : <span>Vistara Studio</span>}
          </div>
          <span style={{ fontSize: 11, color: theme.colors.muted, fontFamily: `'${theme.typography.bodyFont}', sans-serif` }}>
            <span style={{ color: theme.colors.accent, fontWeight: 600 }}>{String(index + 1).padStart(2, '0')}</span>
            <span style={{ opacity: 0.5 }}> / </span>
            {String(spec.slides.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {absolute.map((e) => (
        <Element key={e.id} element={e} />
      ))}

      {manualWaiting && (
        <button
          onClick={onContinue}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full px-5 py-2.5 text-[12.5px] font-medium"
          style={{
            background: theme.colors.accent,
            color: theme.skin === 'dark' ? '#0B0B12' : '#fff',
            boxShadow: `0 12px 32px -10px ${theme.colors.accent}88`,
          }}
        >
          Continue
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ public stage */

export function SpecStage({
  spec,
  index,
  animate = false,
  interactive = false,
  className = '',
}: {
  spec: PresentationSpec;
  index: number;
  animate?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const slide = spec.slides[index] || spec.slides[0];
  const reducedMotion = useReducedMotion();

  const ctx: RenderCtx = useMemo(
    () => ({
      theme: spec.theme,
      motion: spec.motion,
      animate,
      interactive,
      reducedMotion,
      revealed: true,
      slide: spec.slides[index] || null,
      variantsFor: (anim, delayMs) => ({
        variants: elementVariants(anim, spec.motion, reducedMotion),
        transition: elementTransition(anim, spec.motion, delayMs, reducedMotion) as Record<string, unknown>,
      }),
    }),
    [spec, index, animate, interactive, reducedMotion]
  );

  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[12px] font-mono" style={{ background: spec.theme.colors.bg, color: spec.theme.colors.muted }}>
        empty deck
      </div>
    );
  }

  return (
    <RenderContext.Provider value={ctx}>
      <div className={`w-full h-full ${className}`} style={{ background: spec.theme.colors.bg }}>
        <SpecSurface spec={spec} slide={slide} index={index} animate={animate} />
      </div>
    </RenderContext.Provider>
  );
}

function SpecSurface({ spec, slide, index, animate }: { spec: PresentationSpec; slide: SlideSpec; index: number; animate: boolean }) {
  const reducedMotion = useReducedMotion();
  const rx = slideTransition(spec.motion, slide.transition, reducedMotion);
  return (
    <motion.div
      key={slide.id}
      initial={animate ? (rx.initial as never) : undefined}
      animate={rx.animate as never}
      exit={(rx.exit as never) ?? undefined}
      transition={{ duration: rx.dur, ease: spec.motion.easing === 'linear' ? 'linear' : [0.22, 1, 0.36, 1] }}
      className="w-full h-full"
    >
      <ComposedSlideWithTrigger spec={spec} slide={slide} index={index} />
    </motion.div>
  );
}

/** The 'manual' trigger: hold secondary content back until the presenter continues. */
function ComposedSlideWithTrigger({ spec, slide, index }: { spec: PresentationSpec; slide: SlideSpec; index: number }) {
  const manual = spec.motion.trigger === 'manual';
  const [revealed, setRevealed] = useState(slide.id);
  const waiting = manual && revealed !== slide.id;
  const continueReveal = useCallback(() => setRevealed(slide.id), [slide.id]);
  return <ComposedSlideCore spec={spec} slide={slide} index={index} onContinue={continueReveal} manualWaiting={waiting} />;
}

/* ------------------------------------------------------------ scaled canvas */

export function SpecCanvas({
  spec,
  index,
  animate = false,
  interactive = false,
  className = '',
}: {
  spec: PresentationSpec;
  index: number;
  animate?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div className={`w-full relative overflow-hidden ${className}`} style={{ aspectRatio: `${spec.canvas.width} / ${spec.canvas.height}` }}>
      <ScaledSpecInner spec={spec} index={index} animate={animate} interactive={interactive} />
    </div>
  );
}

function ScaledSpecInner({ spec, index, animate, interactive }: { spec: PresentationSpec; index: number; animate: boolean; interactive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / spec.canvas.width);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const raf = requestAnimationFrame(update);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [spec.canvas.width]);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0" style={{ width: spec.canvas.width, height: spec.canvas.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <SpecStage spec={spec} index={index} animate={animate} interactive={interactive} />
      </div>
    </div>
  );
}
