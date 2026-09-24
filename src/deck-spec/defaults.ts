import type { MotionSpec, ThemeSpec } from './types';

/** The studio's default light "paper" deck theme as a full spec theme. */
export function defaultThemeSpec(): ThemeSpec {
  return {
    name: 'Studio Paper',
    skin: 'light',
    colors: {
      bg: '#F7F6F1',
      surface: '#FFFFFF',
      surfaceAlt: '#EFEEE6',
      text: '#17170F',
      muted: '#6E7264',
      accent: '#65A30D',
      accent2: '#0E7490',
      line: 'rgba(23,23,15,0.10)',
    },
    typography: { headingFont: 'Inter Tight', bodyFont: 'Inter', baseSize: 16, scaleRatio: 1.25 },
    spacing: { unit: 8, sectionGap: 48, cardGap: 20 },
    radius: { sm: 10, md: 16, lg: 24, pill: 999 },
    shadows: {
      sm: '0 1px 2px rgba(23,23,15,0.06)',
      md: '0 12px 30px -14px rgba(23,23,15,0.22)',
      lg: '0 32px 80px -32px rgba(23,23,15,0.35)',
      glow: '0 0 42px -8px {accent}',
    },
    effects: { grain: true, glass: false, glowIntensity: 0.55 },
  };
}

export function inkThemeSpec(base: ThemeSpec): ThemeSpec {
  return {
    ...base,
    name: 'Studio Ink',
    skin: 'dark',
    colors: {
      ...base.colors,
      bg: '#08080F',
      surface: '#10101B',
      surfaceAlt: '#171724',
      text: '#F5F5FA',
      muted: '#9CA0B8',
      line: 'rgba(255,255,255,0.09)',
    },
  };
}

export function defaultMotionSpec(): MotionSpec {
  return {
    entrance: 'rise',
    exit: 'fade',
    durationMs: 550,
    delayStaggerMs: 90,
    easing: 'spring-soft',
    transition: 'fade',
    preset: null,
    direction: 'up',
    trigger: 'onEnter',
    parallax: 0,
  };
}
