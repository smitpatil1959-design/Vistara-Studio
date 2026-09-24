/**
 * Runtime validator + normalizer for presentation.v1 documents.
 * Runs identically in the browser and the API (no DOM, no Node APIs).
 */

import type {
  PresentationSpec, SlideSpec, SlideElement, ElementType, AnimationPreset,
  TransitionPreset, ThemeSpec, MotionSpec, ElementContent, SlideSection, ElementPosition, FlowSlot,
} from './types';
import { SPEC_VERSION } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ELEMENT_TYPES: ElementType[] = ['text', 'image', 'icon', 'shape', 'card', 'button', 'chart', 'video', 'group'];
const PRESETS: AnimationPreset[] = ['none', 'fade', 'rise', 'slide', 'zoom', 'stagger', 'blur', 'scale', 'morph'];
const TRANSITIONS: TransitionPreset[] = ['fade', 'slide', 'zoom', 'stagger', 'none', 'morph', 'blur'];
const MOTION_PRESET_IDS = ['cinematic', 'elegant', 'minimal', 'futuristic', 'energetic', 'corporate'];
const MOTION_DIRECTIONS = ['none', 'up', 'down', 'left', 'right'];
const MOTION_TRIGGERS = ['onEnter', 'onCascade', 'onHover', 'manual'];
export const SECTIONS: SlideSection[] = [
  'hero', 'intro', 'problem', 'solution', 'features', 'workflow',
  'architecture', 'benefits', 'technology', 'future', 'cta',
  'market', 'differentiation', 'businessValue', 'growth', 'implementation', 'impact',
  'overview', 'product', 'services', 'pricing', 'comparison', 'metrics',
  'timeline', 'ecosystem', 'audience', 'useCases', 'leadership',
  'custom',
];

export const LEGACY_SECTION_MAP: Record<string, SlideSection> = {
  about: 'overview',
  what_it_does: 'solution',
  conclusion: 'cta',
  company: 'overview',
  geographic_presence: 'market',
  competitive_landscape: 'comparison',
  differentiators: 'differentiation',
  funding_context: 'growth',
  news: 'future',
  security: 'architecture',
  partnerships: 'ecosystem',
  integrations: 'ecosystem',
  use_cases: 'useCases',
  business_model: 'businessValue',
};

export function toCanonicalSection(rawType?: string | null): SlideSection {
  const norm = String(rawType || '').toLowerCase().trim();
  if (!norm) return 'custom';
  if ((SECTIONS as string[]).includes(norm)) return norm as SlideSection;
  if (LEGACY_SECTION_MAP[norm]) return LEGACY_SECTION_MAP[norm];
  return 'custom';
}

const FLOW_SLOTS: FlowSlot[] = ['kicker', 'title', 'subtitle', 'body', 'media', 'stat', 'card', 'action', 'decoration', 'footer'];
const EASINGS = ['linear', 'ease-out', 'ease-in-out', 'spring-soft', 'spring-snappy'];

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function err(errors: string[], path: string, msg: string) {
  if (errors.length < 64) errors.push(`${path}: ${msg}`);
}

function validatePosition(errors: string[], p: unknown, path: string) {
  if (!isObj(p)) return err(errors, path, 'position must be an object');
  const pos = p as Partial<ElementPosition>;
  if (pos.mode !== 'flow' && pos.mode !== 'absolute') err(errors, path + '.mode', 'must be flow|absolute');
  if (pos.slot !== undefined && !FLOW_SLOTS.includes(pos.slot as FlowSlot)) err(errors, path + '.slot', `unknown slot "${String(pos.slot)}"`);
  if (pos.order !== undefined && !isNum(pos.order)) err(errors, path + '.order', 'must be a number');
  if (pos.mode === 'absolute' && (!isNum(pos.x) || !isNum(pos.y))) err(errors, path, 'absolute mode requires numeric x and y');
}

function validateContent(errors: string[], type: ElementType, c: unknown, path: string) {
  if (!isObj(c)) return err(errors, path, 'content must be an object');
  const k = (c as { kind?: unknown }).kind;
  if (k !== type) err(errors, path + '.kind', `kind must equal "${type}"`);
  switch (type) {
    case 'text':
      if (!isStr((c as { text?: unknown }).text)) err(errors, path + '.text', 'required');
      break;
    case 'image':
      if (!isStr((c as { src?: unknown }).src)) err(errors, path + '.src', 'required');
      break;
    case 'icon':
      if (!isStr((c as { name?: unknown }).name)) err(errors, path + '.name', 'required');
      break;
    case 'video':
      if (!isStr((c as { src?: unknown }).src)) err(errors, path + '.src', 'required');
      break;
    case 'button':
      if (!isStr((c as { label?: unknown }).label)) err(errors, path + '.label', 'required');
      break;
    case 'chart':
      if (!Array.isArray((c as { series?: unknown }).series)) err(errors, path + '.series', 'required array');
      break;
    case 'card':
      if (!isStr((c as { title?: unknown }).title)) err(errors, path + '.title', 'required');
      break;
    case 'shape':
      if (!isStr((c as { shape?: unknown }).shape)) err(errors, path + '.shape', 'required');
      break;
    case 'group': {
      const children = (c as { children?: unknown }).children;
      if (!Array.isArray(children)) err(errors, path + '.children', 'required array');
      else children.forEach((child, i) => validateElement(errors, child, `${path}.children[${i}]`));
      break;
    }
  }
}

function validateElement(errors: string[], e: unknown, path: string) {
  if (!isObj(e)) return err(errors, path, 'element must be an object');
  const el = e as Partial<SlideElement>;
  if (!isStr(el.id) || !el.id) err(errors, path + '.id', 'required');
  if (!el.type || !ELEMENT_TYPES.includes(el.type)) err(errors, path + '.type', `unknown type "${String(el.type)}"`);
  validatePosition(errors, el.position, path + '.position');
  if (!isObj(el.size)) err(errors, path + '.size', 'size required');
  if (el.type) validateContent(errors, el.type, el.content, path + '.content');
  if (!isObj(el.animation)) err(errors, path + '.animation', 'required');
  else if (!(PRESETS as string[]).includes(String(el.animation.preset))) err(errors, path + '.animation.preset', 'unknown preset');
}

function validateSlide(errors: string[], s: unknown, path: string) {
  if (!isObj(s)) return err(errors, path, 'slide must be an object');
  const sl = s as Partial<SlideSpec>;
  if (!isStr(sl.id)) err(errors, path + '.id', 'required');
  if (!sl.section || !SECTIONS.includes(sl.section)) err(errors, path + '.section', `unknown section "${String(sl.section)}"`);
  if (!isStr(sl.label)) err(errors, path + '.label', 'required label');
  if (!isObj(sl.background)) err(errors, path + '.background', 'required');
  if (!Array.isArray(sl.elements)) err(errors, path + '.elements', 'required array');
  else sl.elements.forEach((e, i) => validateElement(errors, e, `${path}.elements[${i}]`));
  if (!sl.transition || !TRANSITIONS.includes(sl.transition)) err(errors, path + '.transition', `unknown transition "${String(sl.transition)}"`);
}

function validateTheme(errors: string[], t: unknown, path: string) {
  if (!isObj(t)) return err(errors, path, 'theme required');
  const th = t as Partial<ThemeSpec>;
  if (th.skin !== 'light' && th.skin !== 'dark') err(errors, path + '.skin', 'light|dark');
  const colors = th.colors as Partial<ThemeSpec['colors']> | undefined;
  if (!isObj(colors)) err(errors, path + '.colors', 'required');
  else for (const k of ['bg', 'surface', 'surfaceAlt', 'text', 'muted', 'accent', 'accent2', 'line'] as const)
    if (!isStr(colors[k])) err(errors, `${path}.colors.${k}`, 'required string');
  const typo = th.typography;
  if (!isObj(typo) || !isStr(typo.headingFont) || !isStr(typo.bodyFont)) err(errors, path + '.typography', 'headingFont/bodyFont required');
}

function validateMotion(errors: string[], m: unknown, path: string) {
  if (!isObj(m)) return err(errors, path, 'motion required');
  const mo = m as Partial<MotionSpec>;
  if (!mo.entrance || !(PRESETS as string[]).includes(mo.entrance)) err(errors, path + '.entrance', 'unknown preset');
  if (!mo.exit || !(PRESETS as string[]).includes(mo.exit)) err(errors, path + '.exit', 'unknown preset');
  if (!isNum(mo.durationMs) || mo.durationMs < 0 || mo.durationMs > 4000) err(errors, path + '.durationMs', '0–4000ms');
  if (!EASINGS.includes(String(mo.easing))) err(errors, path + '.easing', 'unknown easing');
  if (!mo.transition || !TRANSITIONS.includes(mo.transition)) err(errors, path + '.transition', 'unknown transition');
  if (mo.preset != null && !MOTION_PRESET_IDS.includes(mo.preset)) err(errors, path + '.preset', 'unknown named preset');
  if (mo.direction && !MOTION_DIRECTIONS.includes(mo.direction)) err(errors, path + '.direction', 'unknown direction');
  if (mo.trigger && !MOTION_TRIGGERS.includes(mo.trigger)) err(errors, path + '.trigger', 'unknown trigger');
  if (mo.parallax != null && (!isNum(mo.parallax) || mo.parallax < 0 || mo.parallax > 1)) err(errors, path + '.parallax', '0–1');
}

export function validatePresentation(doc: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(doc)) return { valid: false, errors: ['document must be an object'] };
  const d = doc as Partial<PresentationSpec>;
  if (d.schemaVersion !== SPEC_VERSION) err(errors, 'schemaVersion', `must be "${SPEC_VERSION}"`);
  if (!isStr(d.id)) err(errors, 'id', 'required');
  if (!isStr(d.name)) err(errors, 'name', 'required');
  if (!isObj(d.canvas) || !isNum(d.canvas.width) || !isNum(d.canvas.height)) err(errors, 'canvas', 'width/height numbers required');
  validateTheme(errors, d.theme, 'theme');
  validateMotion(errors, d.motion, 'motion');
  if (!Array.isArray(d.slides)) err(errors, 'slides', 'required array');
  else {
    const ids = new Set<string>();
    d.slides.forEach((s, i) => {
      validateSlide(errors, s, `slides[${i}]`);
      const sobj = s as Partial<SlideSpec>;
      if (isStr(sobj.id)) {
        if (ids.has(sobj.id)) err(errors, `slides[${i}].id`, 'duplicate slide id');
        ids.add(sobj.id);
      }
    });
  }
  if (!isObj(d.meta)) err(errors, 'meta', 'required');
  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------ normalizer */

const clampStr = (v: unknown, fallback = '') => (isStr(v) ? v : fallback);
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

export function normalizeElement(e: Partial<SlideElement>): SlideElement {
  const type = (ELEMENT_TYPES as string[]).includes(String(e.type)) ? (e.type as ElementType) : 'text';
  return {
    id: clampStr(e.id) || `el-${Math.random().toString(36).slice(2, 9)}`,
    type,
    position: {
      mode: e.position?.mode === 'absolute' ? 'absolute' : 'flow',
      slot: (FLOW_SLOTS as string[]).includes(String(e.position?.slot)) ? (e.position?.slot as FlowSlot) : 'body',
      order: isNum(e.position?.order) ? e.position.order : 0,
      ...(e.position?.mode === 'absolute' ? { x: clampNum(e.position.x, 0, 1280, 0), y: clampNum(e.position.y, 0, 720, 0) } : {}),
    },
    size: { w: e.size?.w ?? 'auto', h: e.size?.h ?? 'auto' },
    content: (e.content || { kind: 'text', text: '', role: 'body' }) as ElementContent,
    style: e.style || {},
    animation: { preset: e.animation?.preset && (PRESETS as string[]).includes(e.animation.preset) ? e.animation.preset : 'fade', delayMs: clampNum(e.animation?.delayMs, 0, 3000, 0) },
    metadata: isObj(e.metadata) ? (e.metadata as SlideElement['metadata']) : {},
  };
}

/** Fills defaults and coerces — the output is always store-safe. Pair with validatePresentation for rejection paths. */
export function normalizePresentation(doc: Partial<PresentationSpec>, defaults: { theme: ThemeSpec; motion: MotionSpec }): PresentationSpec {
  return {
    schemaVersion: SPEC_VERSION,
    id: clampStr(doc.id, cryptoAvailable() ? crypto.randomUUID() : fallbackId()),
    name: clampStr(doc.name, 'Untitled presentation'),
    canvas: { width: clampNum(doc.canvas?.width, 320, 3840, 1280), height: clampNum(doc.canvas?.height, 240, 2160, 720) },
    theme: doc.theme || defaults.theme,
    motion: {
      entrance: doc.motion?.entrance && (PRESETS as string[]).includes(doc.motion.entrance) ? doc.motion.entrance : defaults.motion.entrance,
      exit: doc.motion?.exit && (PRESETS as string[]).includes(doc.motion.exit) ? doc.motion.exit : defaults.motion.exit,
      durationMs: clampNum(doc.motion?.durationMs, 0, 4000, defaults.motion.durationMs),
      delayStaggerMs: clampNum(doc.motion?.delayStaggerMs, 0, 400, defaults.motion.delayStaggerMs),
      easing: (EASINGS as string[]).includes(String(doc.motion?.easing)) ? (doc.motion!.easing as MotionSpec['easing']) : defaults.motion.easing,
      transition: doc.motion?.transition && TRANSITIONS.includes(doc.motion.transition) ? doc.motion.transition : defaults.motion.transition,
      preset: doc.motion?.preset && MOTION_PRESET_IDS.includes(doc.motion.preset) ? doc.motion.preset : (doc.motion?.preset ?? defaults.motion.preset ?? null),
      direction: doc.motion?.direction && MOTION_DIRECTIONS.includes(doc.motion.direction) ? doc.motion.direction : defaults.motion.direction ?? 'up',
      trigger: doc.motion?.trigger && MOTION_TRIGGERS.includes(doc.motion.trigger) ? doc.motion.trigger : defaults.motion.trigger ?? 'onEnter',
      parallax: clampNum(doc.motion?.parallax, 0, 1, defaults.motion.parallax ?? 0),
    },
    slides: Array.isArray(doc.slides) ? doc.slides.map((s, i) => normalizeSlide(s, i)) : [],
    meta: {
      projectUrl: clampStr(doc.meta?.projectUrl),
      purpose: clampStr(doc.meta?.purpose, 'general'),
      source: doc.meta?.source === 'ai-edit' || doc.meta?.source === 'manual-edit' ? doc.meta.source : 'generated',
    },
    updatedAt: isStr(doc.updatedAt) ? doc.updatedAt : new Date().toISOString(),
  };
}

function normalizeSlide(s: Partial<SlideSpec>, i: number): SlideSpec {
  return {
    id: clampStr(s.id, `slide-${i + 1}`),
    section: (SECTIONS as string[]).includes(String(s.section)) ? (s.section as SlideSection) : 'custom',
    label: clampStr(s.label, 'Section'),
    layout: s.layout === 'center' || s.layout === 'split' || s.layout === 'grid' ? s.layout : 'left',
    background: {
      type: s.background?.type === 'gradient' || s.background?.type === 'image' || s.background?.type === 'solid' ? s.background.type : 'theme',
      value: clampStr(s.background?.value),
      ...(s.background?.overlay ? { overlay: s.background.overlay } : {}),
    },
    elements: Array.isArray(s.elements) ? s.elements.map((e) => normalizeElement(e as Partial<SlideElement>)) : [],
    transition: s.transition && TRANSITIONS.includes(s.transition) ? s.transition : 'fade',
    metadata: isObj(s.metadata) ? (s.metadata as SlideSpec['metadata']) : {},
  };
}

function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
}
function fallbackId(): string {
  // slide/element ids must be valid UUIDs — they are projected into uuid columns
  if (cryptoAvailable()) return crypto.randomUUID();
  return '00000000-0000-4000-8000-000000000000'.replace(/0/g, () => ((Math.random() * 16) | 0).toString(16));
}

export { fallbackId as newSpecId };
