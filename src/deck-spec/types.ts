/**
 * Vistara Presentation Specification — presentation.v1
 * ─────────────────────────────────────────────────────────────
 * The single source of truth for a deck. AI generation outputs this schema,
 * the renderer consumes it, manual editing mutates it, AI edits mutate it.
 * The AI never touches React source — only valid spec documents.
 */ 

export const SPEC_VERSION = 'presentation.v1' as const;

/* ------------------------------------------------------------ elements */

export type ElementType = 'text' | 'image' | 'icon' | 'shape' | 'card' | 'button' | 'chart' | 'video' | 'group';

export type FlowSlot =
  | 'kicker'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'media'
  | 'stat'
  | 'card'
  | 'action'
  | 'decoration'
  | 'footer';

export interface ElementPosition {
  /** flow = composed by the slide layout; absolute = canvas coordinates on the 1280×720 stage */
  mode: 'flow' | 'absolute';
  slot?: FlowSlot;
  order?: number;
  x?: number;
  y?: number;
}

export interface ElementSize {
  w: number | 'auto' | 'full' | 'half' | 'third' | 'quarter';
  h: number | 'auto';
}

export type TextRole = 'kicker' | 'title' | 'subtitle' | 'body' | 'caption' | 'overline';
export interface TextContent { kind: 'text'; text: string; role: TextRole; }
export interface ImageContent { kind: 'image'; src: string; alt: string; fit: 'cover' | 'contain'; frame: 'browser' | 'plain' | 'none'; }
export interface IconContent { kind: 'icon'; name: string; pack: 'lucide'; }
export type ShapeKind = 'line' | 'divider' | 'glow' | 'circle' | 'rect' | 'pill';
export interface ShapeContent { kind: 'shape'; shape: ShapeKind; }
export interface CardContent { kind: 'card'; title: string; body: string; icon: string | null; index: number | null; metric: string | null; }
export interface ButtonContent { kind: 'button'; label: string; href: string; variant: 'primary' | 'ghost'; }
export interface ChartContent { kind: 'chart'; chart: 'bars'; series: { label: string; value: number }[]; }
export interface VideoContent { kind: 'video'; src: string; poster: string | null; muted: boolean; }
export interface GroupContent { kind: 'group'; children: SlideElement[]; }

export type ElementContent =
  | TextContent
  | ImageContent
  | IconContent
  | ShapeContent
  | CardContent
  | ButtonContent
  | ChartContent
  | VideoContent
  | GroupContent;

export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  padding?: [number, number, number, number];
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow';
  /** forward-compat: unknown style keys pass through untouched */
  [key: string]: unknown;
}

export type AnimationPreset = 'none' | 'fade' | 'rise' | 'slide' | 'zoom' | 'stagger' | 'blur' | 'scale' | 'morph';
export type MotionDirection = 'none' | 'up' | 'down' | 'left' | 'right';
export type MotionTrigger = 'onEnter' | 'onCascade' | 'onHover' | 'manual';

export interface ElementAnimation {
  preset: AnimationPreset;
  delayMs: number;
  direction?: MotionDirection;
  durationMs?: number;
  easing?: Easing;
}

/** Intent-level motion preset ids — AI + inspector write these. */
export type MotionPresetId = 'cinematic' | 'elegant' | 'minimal' | 'futuristic' | 'energetic' | 'corporate';

export interface SlideElement {
  id: string;
  type: ElementType;
  position: ElementPosition;
  size: ElementSize;
  content: ElementContent;
  style: ElementStyle;
  animation: ElementAnimation;
  metadata: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------ slides */

export type SlideSection =
  | 'hero' | 'intro' | 'problem' | 'solution' | 'features' | 'workflow'
  | 'architecture' | 'benefits' | 'technology' | 'future' | 'cta'
  | 'market' | 'differentiation' | 'businessValue' | 'growth' | 'implementation' | 'impact'
  | 'overview' | 'product' | 'services' | 'pricing' | 'comparison' | 'metrics'
  | 'timeline' | 'ecosystem' | 'audience' | 'useCases' | 'leadership'
  | 'custom';

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image' | 'theme';
  /** solid: hex · gradient: token · image: url · theme: resolve from theme colors */
  value: string;
  overlay?: string;
}

export interface SlideSpec {
  id: string;
  section: SlideSection;
  label: string;
  layout: 'left' | 'center' | 'split' | 'grid';
  background: SlideBackground;
  elements: SlideElement[];
  transition: TransitionPreset;
  metadata: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------ theme */

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  line: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  baseSize: number;
  scaleRatio: number;
}

export interface ThemeSpacing { unit: number; sectionGap: number; cardGap: number; }
export interface ThemeRadius { sm: number; md: number; lg: number; pill: number; }
export interface ThemeShadows { sm: string; md: string; lg: string; glow: string; }
export interface ThemeEffects { grain: boolean; glass: boolean; glowIntensity: number; }

export interface ThemeSpec {
  name: string;
  skin: 'light' | 'dark';
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  effects: ThemeEffects;
}

/* ------------------------------------------------------------ motion */

export type Easing = 'linear' | 'ease-out' | 'ease-in-out' | 'spring-soft' | 'spring-snappy';
export type TransitionPreset = 'fade' | 'slide' | 'zoom' | 'stagger' | 'none' | 'morph' | 'blur';

export interface MotionSpec {
  entrance: AnimationPreset;
  exit: AnimationPreset;
  durationMs: number;
  delayStaggerMs: number;
  easing: Easing;
  transition: TransitionPreset;
  /** named preset currently driving the deck (null = hand-tuned) */
  preset: MotionPresetId | null;
  direction: MotionDirection;
  trigger: MotionTrigger;
  /** gentle continuous drift for imagery when enabled (0 disables) */
  parallax: number;
}

/* ------------------------------------------------------------ document */

export interface PresentationCanvas { width: number; height: number; }

export interface PresentationMeta {
  projectUrl: string;
  purpose: string;
  source: 'generated' | 'ai-edit' | 'manual-edit';
}

export interface PresentationSpec {
  schemaVersion: typeof SPEC_VERSION;
  id: string;
  name: string;
  canvas: PresentationCanvas;
  theme: ThemeSpec;
  motion: MotionSpec;
  slides: SlideSpec[];
  meta: PresentationMeta;
  updatedAt: string;
}
