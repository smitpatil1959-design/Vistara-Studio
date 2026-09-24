import type { DeckTheme } from './types';

export const DEFAULT_THEME: DeckTheme = {
  skin: 'light',
  accent: '#5B8A00',
  accent2: '#0E7490',
  headingFont: 'Inter Tight',
  bodyFont: 'Inter',
  motion: 'smooth',
  radius: 20,
};

export interface Palette {
  id: string;
  name: string;
  accent: string;
  accent2: string;
}

export const PALETTES: Palette[] = [
  { id: 'lime', name: 'Studio Lime', accent: '#65A30D', accent2: '#1A2E05' },
  { id: 'sage', name: 'Sage Field', accent: '#6B8E5A', accent2: '#3E5C3A' },
  { id: 'ultraviolet', name: 'Ultraviolet', accent: '#7C5CFF', accent2: '#0891B2' },
  { id: 'cobalt', name: 'Cobalt Air', accent: '#2563EB', accent2: '#38BDF8' },
  { id: 'sunrise', name: 'Sunrise', accent: '#EA580C', accent2: '#B45309' },
  { id: 'rose', name: 'Pressed Rose', accent: '#E11D48', accent2: '#9F1239' },
  { id: 'teal', name: 'Lagoon', accent: '#0D9488', accent2: '#0369A1' },
  { id: 'mono', name: 'Monolith', accent: '#292524', accent2: '#A8A29E' },
];

export const HEADING_FONTS = [
  { id: 'Inter Tight', name: 'Inter Tight', vibe: 'Studio standard' },
  { id: 'Space Grotesk', name: 'Space Grotesk', vibe: 'Engineered geometric' },
  { id: 'Instrument Serif', name: 'Instrument Serif', vibe: 'Editorial luxury' },
  { id: 'Inter', name: 'Inter', vibe: 'Quietly neutral' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono', vibe: 'Terminal couture' },
];

export interface SkinTokens {
  bg: string;
  panel: string;
  panel2: string;
  text: string;
  muted: string;
  line: string;
}

const SKINS: Record<'dark' | 'light', SkinTokens> = {
  dark: {
    bg: '#08080F',
    panel: '#10101B',
    panel2: '#171724',
    text: '#F5F5FA',
    muted: '#9CA0B8',
    line: 'rgba(255,255,255,0.09)',
  },
  light: {
    bg: '#F7F6F1',
    panel: '#FFFFFF',
    panel2: '#EFEEE6',
    text: '#17170F',
    muted: '#6E7264',
    line: 'rgba(23,23,15,0.10)',
  },
};

export type ResolvedTheme = DeckTheme & SkinTokens;

export function resolveTheme(theme?: Partial<DeckTheme> | null, override?: Record<string, unknown> | null): ResolvedTheme {
  const t: DeckTheme = { ...DEFAULT_THEME, ...(theme || {}) };
  const merged: DeckTheme = { ...t, ...(override as Partial<DeckTheme> | undefined) };
  const skinDefaults = SKINS[merged.skin === 'light' ? 'light' : 'dark'];
  const m = merged as unknown as Record<string, unknown>;
  const customColors = (m.colors as Partial<SkinTokens> | undefined) || {};
  return {
    ...merged,
    ...skinDefaults,
    bg: (customColors.bg as string) || (m.bg as string) || skinDefaults.bg,
    panel: ((customColors as Record<string, string>).surface as string) || (m.panel as string) || skinDefaults.panel,
    panel2: ((customColors as Record<string, string>).surfaceAlt as string) || (m.panel2 as string) || skinDefaults.panel2,
    text: (customColors.text as string) || (m.text as string) || skinDefaults.text,
    muted: ((customColors as Record<string, string>).mutedText as string) || (customColors.muted as string) || (m.muted as string) || skinDefaults.muted,
    line: (customColors.line as string) || (m.line as string) || skinDefaults.line,
  };
}



export const SECTION_LABELS: Record<string, string> = {
  hero: 'Cover',
  intro: 'Introduction',
  problem: 'Problem',
  solution: 'Solution',
  features: 'Features',
  workflow: 'How It Works',
  architecture: 'Architecture',
  benefits: 'Benefits',
  technology: 'Technology',
  future: 'Future Scope',
  cta: 'Call to Action',
  market: 'Market',
  differentiation: 'Differentiation',
  businessValue: 'Business Value',
  growth: 'Growth',
  implementation: 'Implementation',
  impact: 'Impact',
  custom: 'Section',
  testimonials: 'Testimonials',
  pricing: 'Pricing',
  team: 'Team',
  faq: 'FAQ',
  metrics: 'Metrics',
};

export const SLIDE_TYPE_OPTIONS = [
  { id: 'custom', label: 'Blank section' },
  { id: 'features', label: 'Features grid' },
  { id: 'workflow', label: 'How it works' },
  { id: 'benefits', label: 'Metrics / benefits' },
  { id: 'impact', label: 'Impact numbers' },
  { id: 'architecture', label: 'Layered stack' },
  { id: 'implementation', label: 'Implementation plan' },
  { id: 'market', label: 'Market position' },
  { id: 'differentiation', label: 'Differentiation' },
  { id: 'growth', label: 'Growth roadmap' },
  { id: 'solution', label: 'Split statement' },
  { id: 'cta', label: 'Closing / CTA' },
];
