/**
 * Deck spec operations — every mutation the editor or copilot performs is a
 * pure function over the presentation.v1 document. Nothing touches source
 * code or the legacy row model here.
 */

import type {
  AnimationPreset, ElementStyle, ElementType, MotionPresetId, PresentationSpec, SlideElement,
  SlideSection, SlideSpec, ThemeSpec, MotionSpec, SlideBackground, ElementPosition, ElementSize,
  ImageContent, TextContent, ButtonContent, CardContent,
} from './types';
import { newSpecId } from './validate';
import { getMotionPreset } from './motionPresets';

export type Spec = PresentationSpec;

export const cloneSpec = (s: Spec): Spec => JSON.parse(JSON.stringify(s)) as Spec;

function slideOf(spec: Spec, slideId: string): SlideSpec | null {
  return spec.slides.find((s) => s.id === slideId) || null;
}
function elementOf(spec: Spec, slideId: string, elementId: string): SlideElement | null {
  const slide = slideOf(spec, slideId);
  if (!slide) return null;
  const walk = (els: SlideElement[]): SlideElement | null => {
    for (const e of els) {
      if (e.id === elementId) return e;
      if (e.content.kind === 'group') {
        const hit = walk(e.content.children);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(slide.elements);
}

/* ------------------------------------------------------------- elements */

export interface ElementPatch {
  contentText?: string; // text.text
  imageSrc?: string; // image.src
  imageAlt?: string;
  cardTitle?: string;
  cardBody?: string;
  buttonLabel?: string;
  buttonHref?: string;
  iconName?: string; // icon.name
  style?: Partial<ElementStyle>;
  animation?: Partial<SlideElement['animation']>;
  position?: Partial<ElementPosition>;
  size?: Partial<ElementSize>;
}

export function updateElement(spec: Spec, slideId: string, elementId: string, patch: ElementPatch): Spec {
  const next = cloneSpec(spec);
  const el = elementOf(next, slideId, elementId);
  if (!el) return spec;

  if (patch.contentText !== undefined && el.content.kind === 'text') (el.content as TextContent).text = patch.contentText;
  if (patch.imageSrc !== undefined && el.content.kind === 'image') (el.content as ImageContent).src = patch.imageSrc;
  if (patch.imageAlt !== undefined && el.content.kind === 'image') (el.content as ImageContent).alt = patch.imageAlt;
  if (patch.cardTitle !== undefined && el.content.kind === 'card') (el.content as CardContent).title = patch.cardTitle;
  if (patch.cardBody !== undefined && el.content.kind === 'card') (el.content as CardContent).body = patch.cardBody;
  if (patch.buttonLabel !== undefined && el.content.kind === 'button') (el.content as ButtonContent).label = patch.buttonLabel;
  if (patch.buttonHref !== undefined && el.content.kind === 'button') (el.content as ButtonContent).href = patch.buttonHref;
  if (patch.iconName !== undefined && el.content.kind === 'icon') el.content.name = patch.iconName;
  if (patch.style) el.style = { ...el.style, ...patch.style };
  if (patch.animation) el.animation = { ...el.animation, ...patch.animation };
  if (patch.position) el.position = { ...el.position, ...patch.position };
  if (patch.size) el.size = { ...el.size, ...patch.size };
  return next;
}

export function moveElementTo(spec: Spec, slideId: string, elementId: string, x: number, y: number): Spec {
  return updateElement(spec, slideId, elementId, {
    position: {
      mode: 'absolute',
      x: Math.round(Math.max(0, Math.min(1280 - 24, x))),
      y: Math.round(Math.max(0, Math.min(720 - 24, y))),
    },
  });
}

export function resizeElementTo(spec: Spec, slideId: string, elementId: string, w: number, h: number): Spec {
  return updateElement(spec, slideId, elementId, {
    size: { w: Math.round(Math.max(48, Math.min(1280, w))), h: Math.round(Math.max(24, Math.min(720, h))) },
  });
}

export function duplicateElement(spec: Spec, slideId: string, elementId: string): { spec: Spec; newId: string | null } {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  const el = slide ? elementOf(next, slideId, elementId) : null;
  if (!slide || !el) return { spec, newId: null };
  const copy: SlideElement = {
    ...JSON.parse(JSON.stringify(el)),
    id: newSpecId(),
    position: {
      ...el.position,
      mode: 'absolute',
      x: el.position.mode === 'absolute' && typeof el.position.x === 'number' ? el.position.x + 18 : 64,
      y: el.position.mode === 'absolute' && typeof el.position.y === 'number' ? el.position.y + 18 : 64,
    },
  };
  copy.metadata = { ...el.metadata, duplicatedFrom: el.id };
  slide.elements.push(copy);
  return { spec: next, newId: copy.id };
}

export function deleteElement(spec: Spec, slideId: string, elementId: string): Spec {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  const strip = (els: SlideElement[]): SlideElement[] =>
    els.filter((e) => e.id !== elementId).map((e) => (e.content.kind === 'group' ? { ...e, content: { ...e.content, children: strip(e.content.children) } } : e));
  slide.elements = strip(slide.elements);
  return next;
}

/** Layer ordering: flow elements reorder by slot order; absolute elements reorder inside the DOM array. */
export function reorderElement(spec: Spec, slideId: string, elementId: string, dir: 'up' | 'down'): Spec {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  const el = elementOf(next, slideId, elementId);
  if (!el) return spec;

  const arr = slide.elements;
  if (el.position.mode === 'absolute') {
    const i = arr.findIndex((e) => e.id === elementId);
    const j = dir === 'up' ? Math.min(arr.length - 1, i + 1) : Math.max(0, i - 1);
    if (i !== j) [arr[i], arr[j]] = [arr[j], arr[i]];
  } else {
    const peers = arr.filter((e) => e.position.mode === 'flow' && e.position.slot === el.position.slot).sort((a, b) => (a.position.order ?? 0) - (b.position.order ?? 0));
    const i = peers.findIndex((e) => e.id === elementId);
    const j = dir === 'up' ? Math.min(peers.length - 1, i + 1) : Math.max(0, i - 1);
    if (i !== j) {
      const other = peers[j];
      const a = el.position.order ?? i;
      const b = other.position.order ?? j;
      el.position.order = b;
      other.position.order = a;
    }
  }
  return next;
}

/* ------------------------------------------------------------ factories */

const center = { x: 560, y: 320 };

function baseElement(type: ElementType, content: SlideElement['content'], size: ElementSize['w'] | number, height: number | 'auto'): SlideElement {
  return {
    id: newSpecId(),
    type,
    position: { mode: 'absolute', x: center.x, y: center.y },
    size: { w: size, h: height },
    content,
    style: {},
    animation: { preset: 'rise', delayMs: 0 },
    metadata: {},
  };
}

export function makeElement(type: ElementType): SlideElement {
  switch (type) {
    case 'text':
      return baseElement('text', { kind: 'text', text: 'New text', role: 'body' }, 'auto', 'auto');
    case 'image':
      return baseElement('image', { kind: 'image', src: '', alt: 'image', fit: 'cover', frame: 'browser' }, 420, 260);
    case 'icon':
      return baseElement('icon', { kind: 'icon', name: 'sparkles', pack: 'lucide' }, 40, 40);
    case 'shape':
      return baseElement('shape', { kind: 'shape', shape: 'glow' }, 360, 240);
    case 'card':
      return baseElement('card', { kind: 'card', title: 'Card title', body: 'Supporting line', icon: 'sparkles', index: null, metric: null }, 320, 160);
    case 'button':
      return baseElement('button', { kind: 'button', label: 'Learn more', href: '#', variant: 'primary' }, 'auto', 'auto');
    case 'chart':
      return baseElement('chart', { kind: 'chart', chart: 'bars', series: [ { label: 'Q1', value: 44 }, { label: 'Q2', value: 68 }, { label: 'Q3', value: 92 } ] }, 420, 220);
    case 'video':
      return baseElement('video', { kind: 'video', src: '', poster: null, muted: true }, 480, 270);
    case 'group':
      return baseElement('group', { kind: 'group', children: [] }, 'auto', 'auto');
    default:
      return baseElement('text', { kind: 'text', text: 'New text', role: 'body' }, 'auto', 'auto');
  }
}

export function addElement(spec: Spec, slideId: string, type: ElementType): { spec: Spec; newId: string | null } {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return { spec, newId: null };
  const el = makeElement(type);
  slide.elements.push(el);
  return { spec: next, newId: el.id };
}

/* ------------------------------------------------------------- slides */

export function updateSlide(spec: Spec, slideId: string, patch: Partial<Pick<SlideSpec, 'label' | 'layout' | 'transition'>> & { background?: SlideBackground }): Spec {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  if (patch.label !== undefined) slide.label = patch.label;
  if (patch.layout !== undefined) slide.layout = patch.layout;
  if (patch.transition !== undefined) slide.transition = patch.transition;
  if (patch.background !== undefined) slide.background = patch.background;
  return next;
}

export function addSlide(spec: Spec, section: SlideSection, label?: string): { spec: Spec; newId: string } {
  const next = cloneSpec(spec);
  const id = newSpecId();
  next.slides.push({
    id,
    section,
    label: label || 'Section',
    layout: 'left',
    background: { type: 'theme', value: '' },
    elements: [
      baseElement('text', { kind: 'text', text: label || 'New section', role: 'title' }, 'auto', 'auto'),
      baseElement('text', { kind: 'text', text: 'Compose this section in the canvas.', role: 'subtitle' }, 'auto', 'auto'),
    ],
    transition: 'fade',
    metadata: {},
  });
  return { spec: next, newId: id };
}

export function duplicateSlide(spec: Spec, slideId: string): { spec: Spec; newId: string | null } {
  const next = cloneSpec(spec);
  const i = next.slides.findIndex((s) => s.id === slideId);
  if (i === -1) return { spec, newId: null };
  const copy: SlideSpec = JSON.parse(JSON.stringify(next.slides[i]));
  copy.id = newSpecId();
  copy.elements = copy.elements.map((e) => ({ ...e, id: newSpecId() }));
  copy.label = copy.label + ' copy';
  copy.metadata = { ...copy.metadata, duplicatedFrom: slideId };
  next.slides.splice(i + 1, 0, copy);
  return { spec: next, newId: copy.id };
}

export function deleteSlide(spec: Spec, slideId: string): Spec {
  if (spec.slides.length <= 1) return spec;
  const next = cloneSpec(spec);
  next.slides = next.slides.filter((s) => s.id !== slideId);
  return next;
}

export function reorderSlides(spec: Spec, from: number, to: number): Spec {
  const next = cloneSpec(spec);
  if (from === to || from < 0 || to < 0 || from >= next.slides.length || to >= next.slides.length) return spec;
  const [moved] = next.slides.splice(from, 1);
  next.slides.splice(to, 0, moved);
  return next;
}

/* ------------------------------------------------------------- theme/motion */

export interface ThemeSpecPatch {
  skin?: ThemeSpec['skin'];
  name?: string;
  colors?: Partial<ThemeSpec['colors']>;
  typography?: Partial<ThemeSpec['typography']>;
  spacing?: Partial<ThemeSpec['spacing']>;
  radius?: Partial<ThemeSpec['radius']>;
  shadows?: Partial<ThemeSpec['shadows']>;
  effects?: Partial<ThemeSpec['effects']>;
}

export function patchTheme(spec: Spec, patch: ThemeSpecPatch): Spec {
  const next = cloneSpec(spec);
  if (patch.colors) next.theme.colors = { ...next.theme.colors, ...patch.colors };
  if (patch.typography) next.theme.typography = { ...next.theme.typography, ...patch.typography };
  if (patch.radius) next.theme.radius = { ...next.theme.radius, ...patch.radius };
  if (patch.spacing) next.theme.spacing = { ...next.theme.spacing, ...patch.spacing };
  if (patch.shadows) next.theme.shadows = { ...next.theme.shadows, ...patch.shadows };
  if (patch.effects) next.theme.effects = { ...next.theme.effects, ...patch.effects };
  if (patch.name) next.theme.name = patch.name;
  if (patch.skin) next.theme.skin = patch.skin;
  return next;
}

export function patchMotion(spec: Spec, patch: Partial<MotionSpec>): Spec {
  const next = cloneSpec(spec);
  next.motion = { ...next.motion, ...patch };
  return next;
}

export function applyPresetAnimation(spec: Spec, preset: AnimationPreset): Spec {
  // legacy entry point — routes to the preset system
  const map: Record<string, MotionPresetId> = { fade: 'corporate', zoom: 'energetic', stagger: 'cinematic', rise: 'elegant', slide: 'futuristic', none: 'minimal', blur: 'cinematic', scale: 'energetic', morph: 'futuristic', static: 'minimal' };
  const id = map[preset] || 'corporate';
  return setMotionPreset(spec, id);
}

/** Apply a named motion preset across slides + element defaults. */
export function setMotionPreset(spec: Spec, preset: MotionPresetId): Spec {
  const next = cloneSpec(spec);
  const p = getMotionPreset(preset);
  next.motion = { ...next.motion, ...p, preset };
  for (const s of next.slides) {
    s.transition = p.transition === 'none' ? 'fade' : p.transition;
    for (const e of s.elements) {
      // hand-set element delays stay; presets only re-voice entrances
      e.animation = { ...e.animation, preset: p.entrance === 'none' ? 'fade' : (p.entrance as AnimationPreset) };
    }
  }
  return next;
}

/** Manual motion tuning at deck level. */
export function tuneMotion(spec: Spec, patch: Partial<MotionSpec>): Spec {
  const next = cloneSpec(spec);
  next.motion = { ...next.motion, ...patch, preset: null };
  return next;
}
