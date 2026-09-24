/**
 * Vistara Studio — Intelligent Presentation Style Engine
 * 
 * Combines Website Brand DNA + Selected Creative Style + Category Awareness.
 * Never forces rigid templates — synthesizes bespoke, unique design tokens.
 */

import { hexToHsl, hslToHex, contrastRatio } from './engine.js';
import { critiqueAndRepairDeck } from './qualityEngine.js';

export const STYLE_DEFINITIONS = {
  premium: {
    id: 'premium',
    label: 'Premium',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skin: 'dark',
    motion: 'elegant',
    radius: 16,
    imageTreatment: 'framed-mockup',
    density: 'normal',
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    skin: 'light',
    motion: 'minimal',
    radius: 10,
    imageTreatment: 'minimal-restraint',
    density: 'generous',
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter Tight',
    skin: 'dark',
    motion: 'cinematic',
    radius: 18,
    imageTreatment: 'full-bleed',
    density: 'normal',
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skin: 'light',
    motion: 'elegant',
    radius: 12,
    imageTreatment: 'editorial-split',
    density: 'normal',
  },
  corporate: {
    id: 'corporate',
    label: 'Corporate',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    skin: 'light',
    motion: 'corporate',
    radius: 12,
    imageTreatment: 'framed-mockup',
    density: 'normal',
  },
  luxury: {
    id: 'luxury',
    label: 'Luxury',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skin: 'dark',
    motion: 'cinematic',
    radius: 20,
    imageTreatment: 'framed-mockup',
    density: 'generous',
  },
  bold: {
    id: 'bold',
    label: 'Bold',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
    skin: 'dark',
    motion: 'energetic',
    radius: 14,
    imageTreatment: 'full-bleed',
    density: 'compact',
  },
  'modern-tech': {
    id: 'modern-tech',
    label: 'Modern Tech',
    headingFont: 'Space Grotesk',
    bodyFont: 'JetBrains Mono',
    skin: 'dark',
    motion: 'futuristic',
    radius: 14,
    imageTreatment: 'framed-mockup',
    density: 'normal',
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    headingFont: 'Instrument Serif',
    bodyFont: 'Space Grotesk',
    skin: 'dark',
    motion: 'energetic',
    radius: 22,
    imageTreatment: 'editorial-split',
    density: 'normal',
  },
  elegant: {
    id: 'elegant',
    label: 'Elegant',
    headingFont: 'Instrument Serif',
    bodyFont: 'Inter',
    skin: 'light',
    motion: 'elegant',
    radius: 16,
    imageTreatment: 'editorial-split',
    density: 'generous',
  },
};

/**
 * Normalizes input style name or custom phrase to a recognized style profile.
 */
export function resolveStyleKey(input) {
  if (!input || typeof input !== 'string') return 'premium';
  const c = input.toLowerCase().trim();
  if (/\b(modern tech|tech|developer|code|cyber|futuristic)\b/.test(c)) return 'modern-tech';
  if (/\b(minimal|clean|simple|apple|swiss|quiet)\b/.test(c)) return 'minimal';
  if (/\b(cinematic|drama|movie|widescreen|theatrical)\b/.test(c)) return 'cinematic';
  if (/\b(editorial|magazine|journal|vogue)\b/.test(c)) return 'editorial';
  if (/\b(corporate|boardroom|enterprise|business)\b/.test(c)) return 'corporate';
  if (/\b(luxury|luxurious|prestige|expensive|jewelry)\b/.test(c)) return 'luxury';
  if (/\b(bold|loud|punchy|aggressive|high contrast)\b/.test(c)) return 'bold';
  if (/\b(creative|art|artistic|design|studio)\b/.test(c)) return 'creative';
  if (/\b(elegant|graceful|silk|refined|sophisticated)\b/.test(c)) return 'elegant';
  return 'premium';
}

/**
 * Natural language interpreter for custom creative style descriptions.
 */
export function interpretCustomStylePrompt(prompt, visualDna = {}, category = 'general') {
  const p = (prompt || '').toLowerCase();
  const baseKey = resolveStyleKey(p);
  const baseStyle = STYLE_DEFINITIONS[baseKey] || STYLE_DEFINITIONS.premium;

  const isDarkPrompt = /\b(dark|black|obsidian|midnight|noir|night)\b/.test(p);
  const isLightPrompt = /\b(light|white|paper|clean|airy|daylight)\b/.test(p);
  const skin = isDarkPrompt ? 'dark' : isLightPrompt ? 'light' : baseStyle.skin;

  // Custom typography overrides
  let headingFont = baseStyle.headingFont;
  if (/\b(serif|editorial|literary|classic)\b/.test(p)) headingFont = 'Instrument Serif';
  else if (/\b(mono|code|terminal|developer)\b/.test(p)) headingFont = 'JetBrains Mono';
  else if (/\b(grotesk|geometric|modern|space)\b/.test(p)) headingFont = 'Space Grotesk';
  else if (/\b(clean|sans|inter|neutral)\b/.test(p)) headingFont = 'Inter';

  // Custom motion overrides
  let motion = baseStyle.motion;
  if (/\b(cinematic|zoom|dramatic)\b/.test(p)) motion = 'cinematic';
  else if (/\b(calm|subtle|gentle|slow|minimal motion)\b/.test(p)) motion = 'minimal';
  else if (/\b(snappy|fast|energetic|quick)\b/.test(p)) motion = 'energetic';
  else if (/\b(elegant|silk)\b/.test(p)) motion = 'elegant';

  return {
    ...baseStyle,
    skin,
    headingFont,
    motion,
    customPrompt: prompt,
  };
}

/**
 * Combines Website Brand DNA with user-selected Style and Category awareness.
 */
export function combineBrandAndStyle(visualDna = {}, styleOrPrompt = 'premium', category = 'general') {
  const isCustom = typeof styleOrPrompt === 'string' && styleOrPrompt.length > 25;
  const styleConfig = isCustom
    ? interpretCustomStylePrompt(styleOrPrompt, visualDna, category)
    : STYLE_DEFINITIONS[resolveStyleKey(styleOrPrompt)] || STYLE_DEFINITIONS.premium;

  const skin = styleConfig.skin || (visualDna.isDark ? 'dark' : 'light');

  // 1. Color Palette Synthesis from Brand DNA (Never a generic template)
  const prim = visualDna.primary || visualDna.dominantColor || '#65A30D';
  const sec = visualDna.secondary || visualDna.secondaryColor || '#0E7490';
  const primHsl = hexToHsl(prim);

  let accent = prim;
  let accent2 = sec;

  // Enhance accent saturation if style calls for bold / tech, or tone it down for minimal/luxury
  if (styleConfig.id === 'bold' || styleConfig.id === 'modern-tech') {
    accent = hslToHex(primHsl.h, Math.min(1, primHsl.s * 1.15 + 0.1), Math.max(0.45, Math.min(0.65, primHsl.l)));
  } else if (styleConfig.id === 'luxury') {
    // Luxury favors rich jewel tones
    accent = primHsl.s > 0.3 ? prim : '#D4AF37'; // gold fallback if site is totally neutral
  }

  // 2. Surface & Background Luminance
  let bg, surface, surfaceAlt, text, mutedText, line;

  const isGreenSite = primHsl.h >= 75 && primHsl.h <= 165 && primHsl.s >= 0.2;
  const isRedSite = (primHsl.h >= 340 || primHsl.h <= 20) && primHsl.s >= 0.25;
  const isBlueSite = primHsl.h >= 190 && primHsl.h <= 250 && primHsl.s >= 0.2;
  const isMonochrome = primHsl.s < 0.15;

  if (skin === 'dark') {
    if (isGreenSite) {
      bg = styleConfig.id === 'cinematic' ? '#040705' : '#080E0B';
      surface = '#0F1A14';
      surfaceAlt = '#16241C';
      text = '#F0FDF4';
      mutedText = '#869C8E';
      line = 'rgba(240, 253, 244, 0.09)';
    } else if (isRedSite) {
      bg = styleConfig.id === 'cinematic' ? '#070505' : '#0C0A09';
      surface = '#181514';
      surfaceAlt = '#241E1C';
      text = '#FAFAF9';
      mutedText = '#A8A29E';
      line = 'rgba(250, 250, 249, 0.09)';
    } else if (isBlueSite || styleConfig.id === 'modern-tech') {
      bg = styleConfig.id === 'cinematic' ? '#04060A' : '#080C14';
      surface = '#0F1726';
      surfaceAlt = '#162238';
      text = '#F0F7FF';
      mutedText = '#88A2C2';
      line = 'rgba(240, 247, 255, 0.09)';
    } else if (isMonochrome || styleConfig.id === 'luxury') {
      bg = '#09090B';
      surface = '#141417';
      surfaceAlt = '#1E1E24';
      text = '#FAFAFA';
      mutedText = '#A1A1AA';
      line = 'rgba(255, 255, 255, 0.08)';
    } else {
      bg = hslToHex(primHsl.h, Math.min(0.25, primHsl.s * 0.3), 0.05);
      surface = hslToHex(primHsl.h, Math.min(0.28, primHsl.s * 0.35), 0.09);
      surfaceAlt = hslToHex(primHsl.h, Math.min(0.3, primHsl.s * 0.4), 0.14);
      text = '#F8FAFC';
      mutedText = '#94A3B8';
      line = 'rgba(248, 250, 252, 0.08)';
    }
  } else {
    if (isGreenSite) {
      bg = '#F7FAF7';
      surface = '#FFFFFF';
      surfaceAlt = '#EBF4EA';
      text = '#131B15';
      mutedText = '#586A5E';
      line = 'rgba(19, 27, 21, 0.08)';
    } else if (isRedSite) {
      bg = '#FAFAF8';
      surface = '#FFFFFF';
      surfaceAlt = '#F6ECE8';
      text = '#1C1917';
      mutedText = '#685D57';
      line = 'rgba(28, 25, 23, 0.08)';
    } else if (isBlueSite) {
      bg = '#F6F9FD';
      surface = '#FFFFFF';
      surfaceAlt = '#EAF2FA';
      text = '#0F172A';
      mutedText = '#475569';
      line = 'rgba(15, 23, 42, 0.08)';
    } else if (isMonochrome || styleConfig.id === 'minimal') {
      bg = '#F8F8FA';
      surface = '#FFFFFF';
      surfaceAlt = '#EFEFF2';
      text = '#111113';
      mutedText = '#5C5C66';
      line = 'rgba(17, 17, 19, 0.08)';
    } else {
      bg = '#FAFAF9';
      surface = '#FFFFFF';
      surfaceAlt = '#F0EFEA';
      text = '#18181B';
      mutedText = '#52525B';
      line = 'rgba(24, 24, 27, 0.08)';
    }
  }

  // 3. Category Awareness Adjustments
  const catLower = (category || '').toLowerCase();
  let imageTreatment = styleConfig.imageTreatment;
  if (catLower.includes('saas') || catLower.includes('software') || catLower.includes('app')) {
    imageTreatment = 'framed-mockup';
  } else if (catLower.includes('restaurant') || catLower.includes('hospitality') || catLower.includes('travel')) {
    imageTreatment = 'editorial-split';
  } else if (catLower.includes('portfolio') || catLower.includes('creator')) {
    imageTreatment = 'full-bleed';
  }

  // 4. Return complete design tokens
  return {
    styleId: styleConfig.id,
    styleLabel: styleConfig.label,
    skin,
    bg,
    surface,
    surfaceAlt,
    text,
    mutedText,
    line,
    accent,
    accent2,
    headingFont: styleConfig.headingFont,
    bodyFont: styleConfig.bodyFont,
    radius: styleConfig.radius,
    motion: styleConfig.motion,
    imageTreatment,
    density: styleConfig.density,
    colors: {
      bg,
      surface,
      surfaceAlt,
      text,
      muted: mutedText,
      accent,
      accent2,
      line,
    },
    typography: {
      headingFont: styleConfig.headingFont,
      bodyFont: styleConfig.bodyFont,
      baseSize: 16,
      scaleRatio: styleConfig.id === 'bold' || styleConfig.id === 'cinematic' ? 1.3 : 1.25,
    },
  };
}

/**
 * Restyles an entire deck with new creative design tokens while preserving 100% of slide content.
 */
export function restyleDeck(slidesIn, newStyleOrPrompt, visualDna = {}, project = null) {
  const newDesignSystem = combineBrandAndStyle(visualDna, newStyleOrPrompt, project?.understanding?.category || 'general');

  const restyledSlides = slidesIn.map((s) => {
    // Preserve all content text, bullets, and stats exactly
    return {
      ...s,
      theme_override: null, // harmonize deck
    };
  });

  // Run through Quality Engine to verify contrast, zero collision, and rhythm
  const qualityGate = critiqueAndRepairDeck(restyledSlides, newDesignSystem, project);

  return {
    slides: qualityGate.slides,
    designSystem: newDesignSystem,
    quality: qualityGate.quality,
  };
}
