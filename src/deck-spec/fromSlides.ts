/**
 * Bidirectional bridge between the legacy slide rows (Postgres tables) and
 * the canonical Presentation Spec. The spec is the source of truth persisted
 * in project_specs; rows remain the editor's working projection.
 */

import type { DeckTheme, Slide } from '../types';
import type {
  MotionSpec, PresentationMeta, PresentationSpec, SlideElement, SlideSpec,
  ThemeSpec, TransitionPreset,
} from './types';
import { SPEC_VERSION } from './types';
import { defaultMotionSpec, defaultThemeSpec, inkThemeSpec } from './defaults';
import { newSpecId, toCanonicalSection } from './validate';
import { getMotionPreset } from './motionPresets';

const elId = () => newSpecId();

/* ------------------------------------------------------- theme adaptation */

export function themeSpecFromDeck(theme: Partial<DeckTheme> | null | undefined): ThemeSpec {
  const base = theme?.skin === 'dark' ? inkThemeSpec(defaultThemeSpec()) : defaultThemeSpec();
  const rawColors = ((theme as Record<string, unknown> | undefined)?.colors as Record<string, string> | undefined) || {};
  return {
    ...base,
    colors: {
      ...base.colors,
      bg: rawColors.bg || base.colors.bg,
      surface: rawColors.surface || base.colors.surface,
      surfaceAlt: rawColors.surfaceAlt || base.colors.surfaceAlt,
      text: rawColors.text || base.colors.text,
      muted: rawColors.mutedText || rawColors.muted || base.colors.muted,
      accent: theme?.accent || rawColors.accent || base.colors.accent,
      accent2: theme?.accent2 || rawColors.accent2 || base.colors.accent2,
      line: rawColors.line || base.colors.line,
    },
    typography: {
      ...base.typography,
      headingFont: theme?.headingFont || base.typography.headingFont,
      bodyFont: theme?.bodyFont || base.typography.bodyFont,
    },
  };
}


export function motionSpecFromDeck(theme: Partial<DeckTheme> | null | undefined): MotionSpec {
  const m = String(theme?.motion || 'smooth');
  // legacy direction fields dissolve into the preset system
  const preset = (['cinematic', 'elegant', 'minimal', 'futuristic', 'energetic', 'corporate'] as const).find((id) => m === id) || null;
  if (preset) {
    const p = getMotionPreset(preset);
    return { ...defaultMotionSpec(), ...p, preset };
  }
  return {
    ...defaultMotionSpec(),
    durationMs: m === 'snappy' ? 320 : m === 'calm' ? 820 : 550,
    entrance: m === 'snappy' ? 'slide' : 'rise',
    easing: m === 'snappy' ? 'spring-snappy' : 'spring-soft',
    preset: m === 'calm' ? 'elegant' : null,
  };
}

/* ------------------------------------------------------- row → spec slide */

const FONT_ROLES = new Map([
  ['kicker', 12],
  ['title', 56],
  ['subtitle', 20],
  ['body', 17],
  ['caption', 12],
]);

function textEl(slot: SlideElement['position']['slot'], role: 'kicker' | 'title' | 'subtitle' | 'body' | 'caption', text: string, order: number, delayMs: number): SlideElement | null {
  if (!text || !text.trim()) return null;
  return {
    id: elId(),
    type: 'text',
    position: { mode: 'flow', slot, order },
    size: { w: 'auto', h: 'auto' },
    content: { kind: 'text', text, role },
    style: { fontSize: FONT_ROLES.get(role) },
    animation: { preset: role === 'title' ? 'rise' : 'fade', delayMs },
    metadata: {},
  };
}

const splitBullet = (b: string): [string, string] => {
  const i = b.indexOf(' — ');
  return i === -1 ? [b, ''] : [b.slice(0, i), b.slice(i + 3)];
};

export function slideToSpec(slide: Slide, index: number): SlideSpec {
  const elements: SlideElement[] = [];
  const push = (el: SlideElement | null) => el && elements.push(el);

  push(textEl('kicker', 'kicker', (slide.custom_label || slide.type).toUpperCase(), 0, 0));
  push(textEl('title', 'title', slide.title || '', 1, 80));
  push(textEl('subtitle', 'subtitle', slide.subtitle || '', 2, 160));
  push(textEl('body', 'body', slide.body || '', 3, 220));

  (slide.stats || []).forEach((st, i) => {
    elements.push({
      id: elId(),
      type: 'card',
      position: { mode: 'flow', slot: 'stat', order: i },
      size: { w: 'third', h: 'auto' },
      content: { kind: 'card', title: st.label, body: '', icon: null, index: i, metric: st.value },
      style: {},
      animation: { preset: 'stagger', delayMs: 320 + i * 90 },
      metadata: { metric: true },
    });
  });

  (slide.bullets || []).forEach((b, i) => {
    const [title, body] = splitBullet(b);
    elements.push({
      id: elId(),
      type: 'card',
      position: { mode: 'flow', slot: 'card', order: i },
      size: { w: 'third', h: 'auto' },
      content: { kind: 'card', title, body, icon: null, index: i, metric: null },
      style: {},
      animation: { preset: 'stagger', delayMs: 260 + i * 80 },
      metadata: {},
    });
  });

  if (slide.image_url) {
    const vd = (slide as unknown as Record<string, unknown>).visualDecision as Record<string, unknown> | undefined;
    const attr = vd?.attribution as Record<string, string> | undefined;
    elements.push({
      id: elId(),
      type: 'image',
      position: { mode: 'flow', slot: 'media', order: 0 },
      size: { w: 'half', h: 420 },
      content: { kind: 'image', src: slide.image_url, alt: slide.title || 'slide media', fit: 'cover', frame: (vd?.placement === 'browser' ? 'browser' : 'plain') },
      style: { radius: 14 },
      animation: { preset: 'zoom', delayMs: 180 },
      metadata: vd ? {
        visualDecisionType: String(vd.type || ''),
        visualDecisionPlacement: String(vd.placement || ''),
        provider: String(attr?.provider || ''),
        author: String(attr?.author || ''),
      } : {},
    });
  }



  if (slide.type === 'cta') {
    elements.push({
      id: elId(),
      type: 'button',
      position: { mode: 'flow', slot: 'action', order: 0 },
      size: { w: 'auto', h: 'auto' },
      content: { kind: 'button', label: (slide.stats?.[0]?.value || '').trim() || 'Open', href: '#', variant: 'primary' },
      style: {},
      animation: { preset: 'rise', delayMs: 420 },
      metadata: {},
    });
  }

  return {
    id: slide.id,
    section: toCanonicalSection(slide.type),
    label: slide.custom_label || slide.type || 'Section',
    layout: (slide.layout as SlideSpec['layout']) || 'left',
    background: { type: 'theme', value: '' },
    elements,
    transition: (slide.animation as TransitionPreset) || 'fade',
    metadata: { sort_order: slide.sort_order, position: index },
    notes: '',
    sources: (slide.source_urls || []).filter(url => /^https?:\/\//.test(url)).map(url => ({ url })),
  };
}

/** Project every spec slide into the layout engine's renderable model. */
export function getRenderableSlides(spec: PresentationSpec | null): Slide[] {
  if (!spec) return [];
  return spec.slides.map((s, i) => specSlideToRenderable(s, i));
}

export function buildSpecFromSlides(
  project: { id: string; name: string; url: string; theme?: Partial<DeckTheme> | null },
  slides: Slide[],
  source: PresentationMeta['source'],
  purpose = 'general'
): PresentationSpec {
  return {
    schemaVersion: SPEC_VERSION,
    id: `spec-${project.id}`,
    name: `${project.name} — presentation`,
    canvas: { width: 1280, height: 720 },
    theme: themeSpecFromDeck(project.theme),
    motion: motionSpecFromDeck(project.theme),
    slides: [...slides].sort((a, b) => a.sort_order - b.sort_order).map(slideToSpec),
    meta: { projectUrl: project.url, purpose, source },
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------- spec → row (render adapter) */

/** Collapses a spec slide back into the rendering model consumed by SlideCanvas. */
export function specSlideToRenderable(slide: SlideSpec, index: number): Slide {
  const texts = slide.elements.filter((e) => e.type === 'text');
  const bySlot = (slot: string) => texts.find((e) => e.content.kind === 'text' && e.content.role === slot);
  const cards = slide.elements.filter((e) => e.type === 'card' && e.content.kind === 'card');
  const stats = cards.filter((c) => c.position.slot === 'stat');
  const bulletCards = cards.filter((c) => c.position.slot === 'card');
  const image = slide.elements.find((e) => e.type === 'image' && e.content.kind === 'image');

  return {
    id: slide.id,
    project_id: '',
    sort_order: typeof slide.metadata.sort_order === 'number' ? slide.metadata.sort_order : index * 10,
    type: slide.section,
    custom_label: slide.label,
    title: bySlot('title')?.content.kind === 'text' ? (bySlot('title')!.content as { text: string }).text : null,
    subtitle: bySlot('subtitle')?.content.kind === 'text' ? (bySlot('subtitle')!.content as { text: string }).text : null,
    body: bySlot('body')?.content.kind === 'text' ? (bySlot('body')!.content as { text: string }).text : null,
    bullets: bulletCards.map((c) => {
      const cc = c.content as { title: string; body: string };
      return cc.body ? `${cc.title} — ${cc.body}` : cc.title;
    }),
    stats: stats.map((c) => {
      const cc = c.content as { metric: string | null; title: string };
      return { value: cc.metric || '', label: cc.title };
    }),
    image_url: image && image.content.kind === 'image' ? image.content.src : null,
    layout: slide.layout,
    animation: slide.transition,
    theme_override: null,
  };
}
