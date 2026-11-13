import type { BrandKit, BrandSignal, ThemeSpec } from './types';
import { defaultThemeSpec } from './defaults';

export function colorHex(value: unknown): string | null {
  const text = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) return '#' + text.slice(1).split('').map(char => char + char).join('').toUpperCase();
  const rgb = text.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (rgb && rgb.slice(1, 4).every(n => +n <= 255) && (!rgb[4] || +rgb[4] >= 0.8)) return '#' + rgb.slice(1, 4).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}
const channels = (hex: string) => [1, 3, 5].map(offset => parseInt((colorHex(hex) || '#000000').slice(offset, offset + 2), 16));
export function luminance(hex: string): number {
  const values = channels(hex).map(n => { const value = n / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function readableText(bg: string): string {
  if (contrast(bg, '#142019') >= 4.5) return '#142019';
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#000000') ? '#FFFFFF' : '#000000';
}
export function tint(a: string, b: string, amount: number): string {
  const first = channels(a), second = channels(b);
  return '#' + first.map((value, index) => Math.round(value * (1 - amount) + second[index] * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const chroma = (hex: string) => { const rgb = channels(hex); return (Math.max(...rgb) - Math.min(...rgb)) / 255; };
export interface BrandInput {
  name: string; url: string; signals?: BrandSignal[]; logoUrl?: string | null;
  fonts?: string[]; visualStyle?: string; bodyBackground?: string; bodyText?: string;
}

/** Weighted observed signals, never a brand-name lookup or most-common-pixel rule. */
export function deriveBrandKit(input: BrandInput): BrandKit {
  const candidates = (input.signals || []).map(signal => ({ ...signal, value: colorHex(signal.value) || '', confidence: Math.max(0, Math.min(1, signal.confidence)) })).filter(signal => signal.value);
  const score = (signal: BrandSignal) => {
    const role = signal.role.toLowerCase();
    const priority = /css.*primary|brand-primary|official/.test(role) ? 100 : /logo/.test(role) ? 90 : /cta|button/.test(role) ? 80 : /navigation|nav/.test(role) ? 60 : /accent|secondary/.test(role) ? 50 : 15;
    const neutral = chroma(signal.value) < 0.08;
    return priority * signal.confidence + chroma(signal.value) * 15 - (neutral && !/css.*primary|official/.test(role) ? 65 : 0);
  };
  const ranked = candidates.filter(signal => !/background|body-text|surface/.test(signal.role)).sort((a, b) => score(b) - score(a));
  const best = ranked.find(signal => score(signal) > 22) || ranked.find(signal => /logo/.test(signal.role) && signal.confidence >= 0.85 && luminance(signal.value) < 0.08);
  const primary = best?.value || '#506A46';
  const accents = [...new Set(ranked.filter(signal => chroma(signal.value) > 0.12 && score(signal) > 15).map(signal => signal.value))].filter(hex => hex !== primary).slice(0, 4);
  const secondary = accents[0] || tint(primary, '#15281F', 0.58);
  const bg = colorHex(input.bodyBackground) || '#FAFBF8';
  const bodyText = colorHex(input.bodyText) || readableText(bg);
  const style = input.visualStyle || (luminance(bg) < 0.12 ? 'expressive' : chroma(primary) < 0.1 ? 'minimal' : 'modern');
  return {
    brandName: input.name, primaryColor: primary, originalPrimary: primary, secondaryColor: secondary,
    accentColors: accents.length ? accents : [secondary], backgroundColors: [bg, tint(primary, '#FFFFFF', 0.94)],
    textColors: [contrast(bg, bodyText) >= 4.5 ? bodyText : readableText(bg), '#FFFFFF'],
    fontFamilies: [...new Set(input.fonts || [])].filter(font => typeof font === 'string' && font.length < 100).slice(0, 4),
    logoUrl: input.logoUrl || null, visualStyle: style,
    brandPersonality: style === 'minimal' ? ['restrained', 'precise'] : style === 'expressive' ? ['bold', 'energetic'] : ['clear', 'approachable'],
    confidence: best ? Math.min(0.98, best.confidence) : 0,
    sources: candidates.slice(0, 48), isFallback: !best,
  };
}

export type ThemeMood = 'brand' | 'editorial' | 'contrast' | 'soft';
export function themeFromBrand(brand: BrandKit, mood: ThemeMood = 'brand'): ThemeSpec {
  const base = defaultThemeSpec();
  const primary = colorHex(brand.primaryColor) || '#506A46', dark = mood === 'contrast';
  const bg = dark ? tint(primary, '#101916', 0.9) : mood === 'soft' ? tint(primary, '#FFFFFF', 0.93) : '#FBFCF9';
  const foreground = readableText(bg);
  return {
    ...base, name: `${brand.brandName} · ${mood}`, skin: dark ? 'dark' : 'light',
    colors: { bg, surface: dark ? tint(bg, '#FFFFFF', 0.06) : '#FFFFFF', surfaceAlt: dark ? tint(bg, '#FFFFFF', 0.1) : tint(primary, '#FFFFFF', 0.94), text: foreground, muted: tint(foreground, bg, 0.28), accent: primary, accent2: brand.secondaryColor, line: tint(foreground, bg, 0.86) },
    typography: { ...base.typography, headingFont: mood === 'editorial' ? 'Instrument Serif' : brand.fontFamilies.find(font => /inter|grotesk|arial|helvetica|georgia|serif/i.test(font)) || 'Inter Tight', bodyFont: 'Inter' },
    effects: { grain: false, glass: false, glowIntensity: 0 },
    radius: { sm: 8, md: brand.visualStyle === 'minimal' ? 8 : 18, lg: 24, pill: 999 },
  };
}
