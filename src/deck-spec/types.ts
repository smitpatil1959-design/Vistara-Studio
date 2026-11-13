/**
 * Vistara Presentation Specification — presentation.v1
 * ─────────────────────────────────────────────────────────────
 * The single source of truth for a deck. AI generation outputs this schema,
 * the renderer consumes it, manual editing mutates it, AI edits mutate it.
 * The AI never touches React source — only valid spec documents.
 */ 

export const SPEC_VERSION = 'presentation.v2' as const;

/* ------------------------------------------------------------ elements */

export type ElementType = 'text' | 'image' | 'icon' | 'shape' | 'card' | 'button' | 'chart' | 'video' | 'group' | 'table' | 'diagram';

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
export interface ImageContent { kind: 'image'; src: string; alt: string; fit: 'cover' | 'contain'; frame: 'browser' | 'plain' | 'none'; focalPoint?: { x: number; y: number }; }
export interface IconContent { kind: 'icon'; name: string; pack: 'lucide'; }
export type ShapeKind = 'line' | 'divider' | 'glow' | 'circle' | 'rect' | 'pill';
export interface ShapeContent { kind: 'shape'; shape: ShapeKind; }
export interface CardContent { kind: 'card'; title: string; body: string; icon: string | null; index: number | null; metric: string | null; }
export interface ButtonContent { kind: 'button'; label: string; href: string; variant: 'primary' | 'ghost'; }
export interface ChartContent { kind: 'chart'; chart: 'bars' | 'line' | 'area' | 'pie' | 'donut' | 'progress'; series: { label: string; value: number; sourceUrl?: string }[]; colors?: string[]; legend?: boolean; showValues?: boolean; axisLabel?: string; dataSource?: 'verified' | 'user'; }
export interface TableContent { kind: 'table'; rows: string[][]; headerRow: boolean; }
export interface DiagramContent { kind: 'diagram'; layout: 'process' | 'timeline' | 'cycle' | 'architecture'; nodes: { id: string; label: string; detail?: string }[]; edges: { from: string; to: string; label?: string }[]; }
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
  | GroupContent | TableContent | DiagramContent;

export interface ElementStyle {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
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
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
  hidden?: boolean;
  groupId?: string;
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
  composition?: string;
  themeOverride?: Pick<ThemeSpec, 'colors' | 'typography'>;
  notes?: string;
  sources?: SourceReference[];
  validation?: { checkedAt: string; score: number; issues: string[] };
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
  editorVersion?: number;
  migratedFrom?: string;
}

export interface SourceReference { url: string; title?: string; claimId?: string; confidence?: number; }
export interface BrandSignal { value: string; role: string; sourceUrl: string; method: string; confidence: number; }
export interface BrandKit {
  brandName: string; primaryColor: string; secondaryColor: string; accentColors: string[];
  backgroundColors: string[]; textColors: string[]; fontFamilies: string[]; logoUrl: string | null;
  visualStyle: string; brandPersonality: string[]; confidence: number; sources: BrandSignal[];
  isFallback: boolean; originalPrimary?: string;
}
export interface AssetReference { id: string; url: string; sourceUrl?: string; attribution?: string; license?: string; projectId?: string; relevance?: string; }

export interface PresentationSpec {
  schemaVersion: typeof SPEC_VERSION | 'presentation.v1';
  id: string;
  name: string;
  canvas: PresentationCanvas;
  theme: ThemeSpec;
  motion: MotionSpec;
  slides: SlideSpec[];
  meta: PresentationMeta;
  updatedAt: string;
  brand?: BrandKit;
  assets?: AssetReference[];
}
