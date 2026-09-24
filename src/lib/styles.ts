/**
 * Vistara Studio — Intelligent Presentation Style Presets
 * 
 * 10 Art-Directed Creative Directions combining Brand DNA,
 * content structure, and category awareness.
 */

export type CreativeStyleId =
  | 'premium'
  | 'minimal'
  | 'cinematic'
  | 'editorial'
  | 'corporate'
  | 'luxury'
  | 'bold'
  | 'modern-tech'
  | 'creative'
  | 'elegant';

export interface CreativeStyle {
  id: CreativeStyleId;
  label: string;
  tagline: string;
  description: string;
  headingFont: string;
  bodyFont: string;
  skinDefault: 'dark' | 'light';
  motionDefault: 'cinematic' | 'elegant' | 'minimal' | 'futuristic' | 'energetic' | 'corporate';
  radius: number;
  imageTreatment: 'editorial-split' | 'framed-mockup' | 'minimal-restraint' | 'full-bleed';
  vibe: string;
}

export const CREATIVE_STYLES: CreativeStyle[] = [
  {
    id: 'premium',
    label: 'Premium',
    tagline: 'Sophisticated & Balanced',
    description: 'Generous whitespace, refined typography, restrained accents, and strong hierarchy.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skinDefault: 'dark',
    motionDefault: 'elegant',
    radius: 16,
    imageTreatment: 'framed-mockup',
    vibe: 'Refined editorial with obsidian depth',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    tagline: 'Pure Restraint',
    description: 'Crisp monochrome, generous negative space, and quiet typography.',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    skinDefault: 'light',
    motionDefault: 'minimal',
    radius: 10,
    imageTreatment: 'minimal-restraint',
    vibe: 'Paper canvas, neutral type, maximum clarity',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    tagline: 'High Drama & Scale',
    description: 'Large visuals, dramatic scale, deep contrast, and blur-to-clear entrances.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter Tight',
    skinDefault: 'dark',
    motionDefault: 'cinematic',
    radius: 18,
    imageTreatment: 'full-bleed',
    vibe: 'Obsidian stage, widescreen photography',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    tagline: 'Magazine-Inspired',
    description: 'Asymmetric split layouts, literary typography, and sophisticated image placement.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skinDefault: 'light',
    motionDefault: 'elegant',
    radius: 12,
    imageTreatment: 'editorial-split',
    vibe: 'Swiss layout rhythm, serif headlines',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    tagline: 'Structured & Boardroom-Safe',
    description: 'Structured grids, clear information hierarchy, and professional typography.',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    skinDefault: 'light',
    motionDefault: 'corporate',
    radius: 12,
    imageTreatment: 'framed-mockup',
    vibe: 'Clean, trusted, executive clarity',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    tagline: 'Exquisite & Restrained',
    description: 'Deep jewel tones, elegant serif typography, premium imagery, and minimal chrome.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skinDefault: 'dark',
    motionDefault: 'cinematic',
    radius: 20,
    imageTreatment: 'framed-mockup',
    vibe: 'High-end prestige, subtle gold/emerald glows',
  },
  {
    id: 'bold',
    label: 'Bold',
    tagline: 'High Contrast & Expressive',
    description: 'Strong headlines, punchy scale, saturated accents, and energetic cadence.',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
    skinDefault: 'dark',
    motionDefault: 'energetic',
    radius: 14,
    imageTreatment: 'full-bleed',
    vibe: 'Expressive layout, electric accents',
  },
  {
    id: 'modern-tech',
    label: 'Modern Tech',
    tagline: 'Futuristic & Geometric',
    description: 'Geometric headlines, product mockups, and technical data matrices.',
    headingFont: 'Space Grotesk',
    bodyFont: 'JetBrains Mono',
    skinDefault: 'dark',
    motionDefault: 'futuristic',
    radius: 14,
    imageTreatment: 'framed-mockup',
    vibe: 'Developer velocity, monospace accents',
  },
  {
    id: 'creative',
    label: 'Creative',
    tagline: 'Artistic & Dynamic',
    description: 'Visual experimentation, gradient duet accents, and asymmetric compositions.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Space Grotesk',
    skinDefault: 'dark',
    motionDefault: 'energetic',
    radius: 22,
    imageTreatment: 'editorial-split',
    vibe: 'Fluid gradients, artistic freedom',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    tagline: 'Graceful & Timeless',
    description: 'Balanced whitespace, silk rises, subtle visual details, and refined type.',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skinDefault: 'light',
    motionDefault: 'elegant',
    radius: 16,
    imageTreatment: 'editorial-split',
    vibe: 'Unhurried pacing, timeless craftsmanship',
  },
];

export function getCreativeStyle(id: CreativeStyleId | string): CreativeStyle {
  const norm = (id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return CREATIVE_STYLES.find((s) => s.id === norm || s.id.replace('-', '') === norm.replace('-', '')) || CREATIVE_STYLES[0];
}
