import type { StudioPrefs } from '../types';

const KEY = 'vistara.prefs';

export const DEFAULT_PREFS: StudioPrefs = {
  paletteId: 'lime',
  motion: 'smooth',
  skin: 'light',
};

export function getPrefs(): StudioPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<StudioPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: StudioPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
