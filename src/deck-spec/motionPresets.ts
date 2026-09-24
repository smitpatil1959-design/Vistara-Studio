import type { MotionPresetId, MotionSpec } from './types';

/**
 * The six reusable motion presets. Composed, not noisy — every value is tuned
 * around transform/opacity physics, capped distances, and reduced-motion safety.
 */
export interface MotionPreset extends MotionSpec {
  id: MotionPresetId;
  label: string;
  vibe: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    vibe: 'Blur reveals and slow zooms; low travel, high drama',
    entrance: 'blur',
    exit: 'fade',
    durationMs: 900,
    delayStaggerMs: 130,
    easing: 'spring-soft',
    transition: 'morph',
    preset: null,
    direction: 'up',
    trigger: 'onEnter',
    parallax: 0.6,
  },
  {
    id: 'elegant',
    label: 'Elegant',
    vibe: 'Unhurried rises, silk fades, generous spacing',
    entrance: 'rise',
    exit: 'fade',
    durationMs: 780,
    delayStaggerMs: 110,
    easing: 'ease-out',
    transition: 'fade',
    preset: null,
    direction: 'up',
    trigger: 'onEnter',
    parallax: 0.25,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    vibe: 'Opacity and quiet fades only — restraint as style',
    entrance: 'fade',
    exit: 'fade',
    durationMs: 340,
    delayStaggerMs: 60,
    easing: 'ease-in-out',
    transition: 'fade',
    preset: null,
    direction: 'none',
    trigger: 'onEnter',
    parallax: 0,
  },
  {
    id: 'futuristic',
    label: 'Futuristic',
    vibe: 'Lateral glides, scale snaps, electric velocity',
    entrance: 'slide',
    exit: 'zoom',
    durationMs: 460,
    delayStaggerMs: 70,
    easing: 'spring-snappy',
    transition: 'slide',
    preset: null,
    direction: 'left',
    trigger: 'onEnter',
    parallax: 0.4,
  },
  {
    id: 'energetic',
    label: 'Energetic',
    vibe: 'Fast rises and punchy scale, tight cadence',
    entrance: 'scale',
    exit: 'fade',
    durationMs: 320,
    delayStaggerMs: 65,
    easing: 'spring-snappy',
    transition: 'zoom',
    preset: null,
    direction: 'up',
    trigger: 'onEnter',
    parallax: 0.2,
  },
  {
    id: 'corporate',
    label: 'Corporate',
    vibe: 'Boardroom-safe fades; nothing calls attention to itself',
    entrance: 'fade',
    exit: 'fade',
    durationMs: 520,
    delayStaggerMs: 90,
    easing: 'ease-in-out',
    transition: 'fade',
    preset: null,
    direction: 'none',
    trigger: 'onEnter',
    parallax: 0,
  },
];

export function getMotionPreset(id: MotionPresetId): MotionPreset {
  return MOTION_PRESETS.find((p) => p.id === id) || MOTION_PRESETS[2];
}

/** Fuzzy name → preset resolution, shared with the AI director. */
const PRESET_SYNONYMS: Record<string, MotionPresetId> = {
  cinematic: 'cinematic', movie: 'cinematic', film: 'cinematic', dramatic: 'cinematic', hollywood: 'cinematic', oscar: 'cinematic',
  elegant: 'elegant', elegance: 'elegant', sophisticated: 'elegant', luxe: 'elegant', luxury: 'elegant', graceful: 'elegant', editorial: 'elegant',
  minimal: 'minimal', simple: 'minimal', clean: 'minimal', subtle: 'minimal', quiet: 'minimal', swiss: 'minimal', restrained: 'minimal',
  futuristic: 'futuristic', neon: 'futuristic', hud: 'futuristic', cyberpunk: 'futuristic', sci: 'futuristic', scifi: 'futuristic', cyber: 'futuristic',
  energetic: 'energetic', punchy: 'energetic', lively: 'energetic', vibrant: 'energetic', bold: 'energetic', snappy: 'energetic', fast: 'energetic',
  corporate: 'corporate', boardroom: 'corporate', formal: 'corporate', conservative: 'corporate', professional: 'corporate', conservativeboard: 'corporate',
};

export function resolveMotionPreset(text: string): MotionPresetId | null {
  const words = String(text).toLowerCase().match(/[a-z]+/g) || [];
  for (const w of words) {
    if (PRESET_SYNONYMS[w]) return PRESET_SYNONYMS[w];
  }
  return null;
}
